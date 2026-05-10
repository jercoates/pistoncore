# pistoncore/backend/ha_client.py
#
# Home Assistant WebSocket client.
# Handles all communication with HA on behalf of the backend.
#
# The frontend NEVER calls HA directly — all HA data flows through here.
#
# Auth modes:
#   supervisor — reads SUPERVISOR_TOKEN from environment (addon deployment)
#   token      — reads ha_url and ha_token from config.json (Docker deployment)
#
# Usage:
#   from ha_client import ha_client
#   devices = ha_client.get_devices()
#
# After settings save, call ha_client.reload_config() to pick up new values.
#
# Caching:
#   Device list is cached for DEVICE_CACHE_TTL seconds.
#   Capability data is cached per entity_id for CAPABILITY_CACHE_TTL seconds.
#   Service data is cached per domain for CAPABILITY_CACHE_TTL seconds.
#   Cache is in-process memory — clears on container restart.
#   Call ha_client.invalidate_cache() to force a refresh (e.g. after config change).

import asyncio
import concurrent.futures
import json
import logging
import os
import time
from typing import Any

import websockets

import storage

logger = logging.getLogger("ha_client")

# ---------------------------------------------------------------------------
# Cache TTLs
# ---------------------------------------------------------------------------

DEVICE_CACHE_TTL = 60        # seconds — device list changes rarely
CAPABILITY_CACHE_TTL = 120   # seconds — attributes change rarely

# ---------------------------------------------------------------------------
# Domain filter — only show domains useful for automation
# Everything else (backup, update, event, button, weather, sun, etc.) hidden
# ---------------------------------------------------------------------------
ALLOWED_DOMAINS = {
    "light", "switch", "binary_sensor", "sensor", "media_player",
    "cover", "climate", "fan", "lock", "input_boolean", "input_number",
    "input_select", "person", "device_tracker", "alarm_control_panel",
    "vacuum", "camera", "scene", "script", "automation", "humidifier",
    "water_heater", "remote", "siren", "valve",
}


# ---------------------------------------------------------------------------
# Attribute type detection sets — WIZARD_SPEC priority order
# ---------------------------------------------------------------------------

_BINARY_DEVICE_CLASSES = {
    "motion", "door", "window", "smoke", "moisture", "occupancy",
    "plug", "outlet", "lock", "battery", "carbon_monoxide", "cold",
    "connectivity", "garage_door", "gas", "heat", "light", "moving",
    "opening", "problem", "running", "safety", "sound", "tamper",
    "update", "vibration",
}

_NUMERIC_DEVICE_CLASSES = {
    "temperature", "humidity", "battery", "illuminance", "power",
    "energy", "signal_strength", "pm25", "co2", "voltage", "current",
    "pressure", "speed", "distance", "duration", "data_rate",
    "data_size", "frequency", "irradiance", "precipitation",
    "precipitation_intensity", "reactive_power", "apparent_power",
    "aqi", "nitrogen_dioxide", "nitrogen_monoxide", "nitrous_oxide",
    "ozone", "pm1", "pm10", "sulphur_dioxide", "volatile_organic_compounds",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_entity_label(entity_id: str, friendly_name: str) -> str:
    """
    Build a display label that disambiguates entities with the same friendly name.

    Rules:
    1. Strip domain prefix from entity_id, replace underscores with spaces,
       title-case → parsed_name
    2. If friendly_name already contains the parsed suffix info, just use
       friendly_name as-is.
    3. If friendly_name is a prefix of parsed_name (i.e. HA auto-generated a
       suffix), append the extra part: "Basement — Volume"
    4. Otherwise just use friendly_name.
    """
    local = entity_id.split(".", 1)[-1]           # e.g. "basement_volume"
    parsed = local.replace("_", " ").title()      # e.g. "Basement Volume"

    fn_lower = friendly_name.lower().strip()
    parsed_lower = parsed.lower().strip()

    if fn_lower == parsed_lower:
        return friendly_name

    if parsed_lower.startswith(fn_lower):
        suffix = parsed[len(friendly_name):].strip().title()
        if suffix:
            return f"{friendly_name} — {suffix}"

    return friendly_name


def _detect_attribute_type(domain: str, device_class: str | None, attrs: dict) -> str:
    """
    Detect attribute type per WIZARD_SPEC detection priority order.
    Returns one of: binary, numeric, numeric_position, enum, ha_boolean,
                    location, unknown
    """
    if device_class and device_class in _BINARY_DEVICE_CLASSES:
        return "binary"
    if device_class and device_class in _NUMERIC_DEVICE_CLASSES:
        return "numeric"
    if attrs.get("unit_of_measurement"):
        return "numeric"
    if attrs.get("options"):
        return "enum"
    if domain == "cover" and "current_position" in attrs:
        return "numeric_position"
    if domain == "light" and "brightness" in attrs:
        return "numeric_position"
    if domain == "input_boolean":
        return "ha_boolean"
    if domain in ("person", "device_tracker"):
        return "location"
    if domain == "sensor":
        return "enum"
    return "unknown"


def _field_type(field_data: dict) -> str:
    """Map HA service field selector to a PistonCore field type."""
    selector = field_data.get("selector", {})
    if "number" in selector:
        return "number"
    if "boolean" in selector:
        return "boolean"
    if "select" in selector:
        return "select"
    if "text" in selector:
        return "text"
    if "color_temp" in selector:
        return "color_temp"
    if "color_rgb" in selector:
        return "color_rgb"
    if "time" in selector:
        return "time"
    if "entity" in selector:
        return "entity"
    return "text"  # fallback


# ---------------------------------------------------------------------------
# Exception
# ---------------------------------------------------------------------------

class HAClientError(Exception):
    """Raised when HA communication fails."""
    pass


# ---------------------------------------------------------------------------
# HAClient
# ---------------------------------------------------------------------------

class HAClient:
    """
    Single class for all HA WebSocket communication.

    Auth modes (DESIGN.md Section 4):
      supervisor — SUPERVISOR_TOKEN env var (addon deployment)
      token      — ha_url + ha_token from config.json (Docker deployment)

    Create once as a module-level singleton. Import and call directly:
      from ha_client import ha_client
    """

    def __init__(self):
        self._cache: dict[str, tuple[float, Any]] = {}
        # One persistent executor — reused across all calls (Bug 26 fix)
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        self._load_auth()

    def _load_auth(self):
        """Detect auth mode and load credentials."""
        supervisor_token = os.environ.get("SUPERVISOR_TOKEN")
        if supervisor_token:
            self._auth_mode = "supervisor"
            self._token = supervisor_token
            # Supervisor: HA is always at the internal supervisor proxy URL
            self._ha_url = "http://supervisor/core"
        else:
            self._auth_mode = "token"
            config = storage.load_config()
            self._token = config.get("ha_token", "")
            self._ha_url = config.get("ha_url", "http://homeassistant.local:8123")

    def reload_config(self):
        """
        Re-read ha_url and ha_token from config.json and clear cache.
        Call this after the user saves settings — token mode only.
        No-op in supervisor mode (token comes from environment, not config).
        """
        if self._auth_mode == "token":
            config = storage.load_config()
            self._token = config.get("ha_token", "")
            self._ha_url = config.get("ha_url", "http://homeassistant.local:8123")
        self.invalidate_cache()
        logger.info("HAClient config reloaded (auth_mode=%s)", self._auth_mode)

    # -----------------------------------------------------------------------
    # Cache helpers
    # -----------------------------------------------------------------------

    def _cache_get(self, key: str, ttl: int) -> Any | None:
        entry = self._cache.get(key)
        if entry is None:
            return None
        ts, value = entry
        if time.monotonic() - ts > ttl:
            del self._cache[key]
            return None
        return value

    def _cache_set(self, key: str, value: Any):
        self._cache[key] = (time.monotonic(), value)

    def invalidate_cache(self):
        """Clear all cached HA data."""
        self._cache.clear()

    # -----------------------------------------------------------------------
    # WebSocket transport
    # -----------------------------------------------------------------------

    async def _ws_call(self, messages: list[dict]) -> list[Any]:
        """
        Open a WebSocket connection to HA, authenticate, send all messages,
        collect results, close. Returns a list of result payloads in order.

        Each message must include an `id` field. The function waits until it
        has received a result for every message ID before returning.
        """
        if not self._token:
            raise HAClientError("No HA token configured. Set ha_token in PistonCore config.")

        ws_url = (
            self._ha_url.rstrip("/")
            .replace("http://", "ws://")
            .replace("https://", "wss://")
            + "/api/websocket"
        )

        pending_ids = {m["id"] for m in messages}
        results: dict[int, Any] = {}

        try:
            async with websockets.connect(ws_url, open_timeout=10) as ws:
                auth_req = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                if auth_req.get("type") != "auth_required":
                    raise HAClientError(f"Unexpected HA handshake: {auth_req}")

                await ws.send(json.dumps({"type": "auth", "access_token": self._token}))
                auth_resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                if auth_resp.get("type") != "auth_ok":
                    raise HAClientError("HA authentication failed. Check ha_token in config.")

                for msg in messages:
                    await ws.send(json.dumps(msg))

                while pending_ids:
                    raw = await asyncio.wait_for(ws.recv(), timeout=15)
                    msg = json.loads(raw)
                    msg_id = msg.get("id")
                    if msg_id in pending_ids and msg.get("type") == "result":
                        pending_ids.discard(msg_id)
                        results[msg_id] = msg

        except websockets.exceptions.WebSocketException as e:
            raise HAClientError(f"WebSocket error: {e}") from e
        except asyncio.TimeoutError:
            raise HAClientError("Timed out waiting for HA response.")
        except OSError as e:
            raise HAClientError(f"Could not connect to HA at {ws_url}: {e}") from e

        return [results[m["id"]] for m in messages]

    def _run(self, coro) -> Any:
        """
        Run an async coroutine from a sync context.
        Reuses the persistent ThreadPoolExecutor (Bug 26 fix — no per-call pool creation).
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                future = self._executor.submit(asyncio.run, coro)
                return future.result(timeout=30)
            else:
                return loop.run_until_complete(coro)
        except RuntimeError:
            return asyncio.run(coro)

    # -----------------------------------------------------------------------
    # Public API — Devices
    # -----------------------------------------------------------------------

    def get_devices(self) -> list[dict]:
        """
        Return all HA entities (devices) with id, friendly_name, area, domain.
        Result is cached for DEVICE_CACHE_TTL seconds.

        Returns a list of:
          {
            "entity_id":     "light.driveway_main",
            "friendly_name": "Driveway Main Light",
            "domain":        "light",
            "area":          "Driveway",          # may be null
            "device_id":     "abc123..."          # HA device registry ID, may be null
          }
        """
        cached = self._cache_get("devices", DEVICE_CACHE_TTL)
        if cached is not None:
            return cached

        result = self._run(self._fetch_devices())
        self._cache_set("devices", result)
        return result

    async def _fetch_devices(self) -> list[dict]:
        """Fetch entity list + area registry from HA, merge, return normalized list."""
        results = await self._ws_call([
            {"id": 1, "type": "get_states"},
            {"id": 2, "type": "config/area_registry/list"},
            {"id": 3, "type": "config/entity_registry/list"},
        ])

        states_resp, areas_resp, entity_resp = results

        if not states_resp.get("success"):
            raise HAClientError("HA returned error for get_states.")

        area_map: dict[str, str] = {}
        if areas_resp.get("success"):
            for area in areas_resp.get("result", []):
                area_map[area["area_id"]] = area["name"]

        entity_meta: dict[str, dict] = {}
        if entity_resp.get("success"):
            for entry in entity_resp.get("result", []):
                entity_meta[entry["entity_id"]] = {
                    "area_id": entry.get("area_id"),
                    "device_id": entry.get("device_id"),
                }

        devices = []
        for state in states_resp.get("result", []):
            entity_id = state["entity_id"]
            domain = entity_id.split(".")[0]

            if domain not in ALLOWED_DOMAINS:
                continue

            attrs = state.get("attributes", {})
            friendly_name = attrs.get("friendly_name") or entity_id

            meta = entity_meta.get(entity_id, {})
            area_id = meta.get("area_id")
            area_name = area_map.get(area_id) if area_id else None

            display_name = _parse_entity_label(entity_id, friendly_name)

            devices.append({
                "entity_id": entity_id,
                "friendly_name": display_name,
                "domain": domain,
                "area": area_name,
                "device_id": meta.get("device_id"),
            })

        devices.sort(key=lambda d: (d["area"] is None, (d["area"] or "").lower(), d["friendly_name"].lower()))
        return devices

    # -----------------------------------------------------------------------
    # Public API — Capabilities
    # -----------------------------------------------------------------------

    def get_capabilities(self, entity_id: str) -> dict:
        """
        Return capabilities for a single entity.
        Runs attribute_type detection per WIZARD_SPEC detection priority order.

        Returns:
          {
            "entity_id": "binary_sensor.front_door",
            "state":     "on",
            "domain":    "binary_sensor",
            "device_class": "door",
            "capabilities": [
              {
                "name":           "state",
                "attribute_type": "binary",
                "device_class":   "door",
                "unit":           null,
                "options":        null
              }
            ]
          }
        """
        cache_key = f"cap:{entity_id}"
        cached = self._cache_get(cache_key, CAPABILITY_CACHE_TTL)
        if cached is not None:
            return cached

        result = self._run(self._fetch_capabilities(entity_id))
        self._cache_set(cache_key, result)
        return result

    async def _fetch_capabilities(self, entity_id: str) -> dict:
        results = await self._ws_call([
            {"id": 1, "type": "get_states"},
        ])
        states_resp = results[0]

        if not states_resp.get("success"):
            raise HAClientError("HA returned error for get_states.")

        state_obj = None
        for s in states_resp.get("result", []):
            if s["entity_id"] == entity_id:
                state_obj = s
                break

        if state_obj is None:
            raise HAClientError(f"Entity '{entity_id}' not found in HA.")

        domain = entity_id.split(".")[0]
        attrs = state_obj.get("attributes", {})
        device_class = attrs.get("device_class")
        current_state = state_obj.get("state")

        capabilities = []

        state_cap = {
            "name": "state",
            "attribute_type": _detect_attribute_type(domain, device_class, attrs),
            "device_class": device_class,
            "unit": attrs.get("unit_of_measurement"),
            "options": attrs.get("options"),
        }
        capabilities.append(state_cap)

        _NUMERIC_ATTRS = {
            "brightness": ("numeric_position", None),
            "current_position": ("numeric_position", None),
            "battery_level": ("numeric", None),
            "color_temp": ("numeric", None),
            "volume_level": ("numeric", None),
        }
        for attr_name, (atype, unit) in _NUMERIC_ATTRS.items():
            if attr_name in attrs:
                capabilities.append({
                    "name": attr_name,
                    "attribute_type": atype,
                    "device_class": None,
                    "unit": unit,
                    "options": None,
                })

        return {
            "entity_id": entity_id,
            "state": current_state,
            "domain": domain,
            "device_class": device_class,
            "capabilities": capabilities,
        }

    # -----------------------------------------------------------------------
    # Public API — Services
    # -----------------------------------------------------------------------

    def get_services(self, entity_id: str) -> list[dict]:
        """
        Return valid services for a device's domain with parameter schema.
        Result is cached per domain — not per entity_id (Bug 27 fix).

        Returns a list of:
          {
            "service":     "turn_on",
            "label":       "Turn On",
            "description": "Turn on the light",
            "fields": [
              { "name": "brightness_pct", "label": "Brightness", "type": "number",
                "min": 0, "max": 100, "unit": "%" }
            ]
          }
        """
        domain = entity_id.split(".")[0]
        cache_key = f"svc:{domain}"   # Bug 27 fix — cache by domain, not entity_id
        cached = self._cache_get(cache_key, CAPABILITY_CACHE_TTL)
        if cached is not None:
            return cached

        result = self._run(self._fetch_services(entity_id))
        self._cache_set(cache_key, result)
        return result

    async def _fetch_services(self, entity_id: str) -> list[dict]:
        domain = entity_id.split(".")[0]

        results = await self._ws_call([
            {"id": 1, "type": "get_services"},
        ])
        svc_resp = results[0]

        if not svc_resp.get("success"):
            raise HAClientError("HA returned error for get_services.")

        all_services = svc_resp.get("result", {})
        domain_services = all_services.get(domain, {})

        output = []
        for svc_name, svc_data in domain_services.items():
            fields = []
            for field_name, field_data in svc_data.get("fields", {}).items():
                field = {
                    "name": field_name,
                    "label": field_data.get("name", field_name.replace("_", " ").title()),
                    "description": field_data.get("description", ""),
                    "type": _field_type(field_data),
                    "required": field_data.get("required", False),
                }
                selector = field_data.get("selector", {})
                if "number" in selector:
                    num = selector["number"]
                    field["min"] = num.get("min")
                    field["max"] = num.get("max")
                    field["unit"] = num.get("unit_of_measurement")
                    field["step"] = num.get("step", 1)
                if "select" in selector:
                    field["options"] = selector["select"].get("options", [])
                fields.append(field)

            output.append({
                "service": svc_name,
                "label": svc_data.get("name", svc_name.replace("_", " ").title()),
                "description": svc_data.get("description", ""),
                "fields": fields,
            })

        output.sort(key=lambda s: s["label"])
        return output

    # -----------------------------------------------------------------------
    # Public API — All States (used by compiler for fat context)
    # -----------------------------------------------------------------------

    def get_all_states(self) -> dict:
        """
        Return all HA entity states as a dict keyed by entity_id.
        Each value is {"state": str, "attributes": dict}.
        Raises HAClientError on failure — caller must abort deploy.
        """
        return self._run(self._fetch_all_states())

    async def _fetch_all_states(self) -> dict:
        results = await self._ws_call([
            {"id": 1, "type": "get_states"},
        ])
        resp = results[0]
        if not resp.get("success"):
            raise HAClientError("HA returned error for get_states.")
        out = {}
        for entity in resp.get("result", []):
            out[entity["entity_id"]] = {
                "state":      entity.get("state", ""),
                "attributes": entity.get("attributes", {}),
            }
        return out

    # -----------------------------------------------------------------------
    # Public API — Services for domains (used by compiler for fat context)
    # -----------------------------------------------------------------------

    def get_services_for_domains(self, domains: set) -> dict:
        """
        Return raw HA service data for the requested domains only.
        Returns {} and logs a warning on failure — never raises.
        Caller degrades gracefully.
        """
        try:
            return self._run(self._fetch_services_for_domains(domains))
        except HAClientError as e:
            logger.warning("get_services_for_domains failed: %s", e)
            return {}

    async def _fetch_services_for_domains(self, domains: set) -> dict:
        results = await self._ws_call([
            {"id": 1, "type": "get_services"},
        ])
        resp = results[0]
        if not resp.get("success"):
            raise HAClientError("HA returned error for get_services.")
        all_services = resp.get("result", {})
        return {d: all_services[d] for d in domains if d in all_services}

    # -----------------------------------------------------------------------
    # Public API — Areas
    # -----------------------------------------------------------------------

    def get_areas(self) -> dict:
        """
        Return HA area registry as {area_id: area_name}.
        Returns {} and logs a warning on failure — never raises.
        """
        try:
            return self._run(self._fetch_areas())
        except HAClientError as e:
            logger.warning("get_areas failed: %s", e)
            return {}

    async def _fetch_areas(self) -> dict:
        results = await self._ws_call([
            {"id": 1, "type": "config/area_registry/list"},
        ])
        resp = results[0]
        if not resp.get("success"):
            raise HAClientError("HA returned error for area_registry/list.")
        return {a["area_id"]: a["name"] for a in resp.get("result", [])}

    # -----------------------------------------------------------------------
    # Public API — HA Version
    # -----------------------------------------------------------------------

    def get_ha_version(self) -> str:
        """
        Return the HA version string from the auth_ok WebSocket handshake.
        Returns "unknown" on any failure — never raises.
        """
        try:
            return self._run(self._fetch_ha_version())
        except Exception as e:
            logger.warning("get_ha_version failed: %s", e)
            return "unknown"

    async def _fetch_ha_version(self) -> str:
        ws_url = (
            self._ha_url.rstrip("/")
            .replace("http://", "ws://")
            .replace("https://", "wss://")
            + "/api/websocket"
        )

        try:
            async with websockets.connect(ws_url, open_timeout=10) as ws:
                auth_req = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                if auth_req.get("type") != "auth_required":
                    return "unknown"
                await ws.send(json.dumps({"type": "auth", "access_token": self._token}))
                auth_resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                if auth_resp.get("type") != "auth_ok":
                    return "unknown"
                return auth_resp.get("ha_version", "unknown")
        except Exception:
            return "unknown"

    # -----------------------------------------------------------------------
    # Public API — Call Service
    # -----------------------------------------------------------------------

    def call_service(self, domain: str, service: str, service_data: dict = None) -> dict:
        """
        Call a Home Assistant service via WebSocket.
        Used by the deploy endpoint for automation.reload, script.reload,
        and pyscript.reload after writing compiled files.
        Returns the HA result payload.
        Raises HAClientError on failure.
        """
        return self._run(self._call_service(domain, service, service_data or {}))

    async def _call_service(self, domain: str, service: str, service_data: dict) -> dict:
        results = await self._ws_call([
            {
                "id": 1,
                "type": "call_service",
                "domain": domain,
                "service": service,
                "service_data": service_data,
            }
        ])
        result = results[0]
        if not result.get("success"):
            error = result.get("error", {})
            raise HAClientError(
                f"HA service {domain}.{service} failed: "
                f"{error.get('message', 'unknown error')}"
            )
        return result


# ---------------------------------------------------------------------------
# Module-level singleton — import and use directly
# ---------------------------------------------------------------------------

ha_client = HAClient()
