# pistoncore/backend/ha_client.py
#
# Home Assistant WebSocket client.
# Handles all communication with HA on behalf of the backend.
#
# The frontend NEVER calls HA directly — all HA data flows through here.
#
# Caching:
#   Device list is cached for DEVICE_CACHE_TTL seconds.
#   Capability data is cached per entity_id for CAPABILITY_CACHE_TTL seconds.
#   Cache is in-process memory — clears on container restart.
#   Call invalidate_cache() to force a refresh (e.g. after a config change).

import asyncio
import json
import logging
import time
from typing import Any

import websockets

import storage

logger = logging.getLogger("ha_client")

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

DEVICE_CACHE_TTL = 60        # seconds — device list changes rarely
CAPABILITY_CACHE_TTL = 120   # seconds — attributes change rarely

_cache: dict[str, tuple[float, Any]] = {}  # key -> (timestamp, value)


def _cache_get(key: str, ttl: int) -> Any | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    ts, value = entry
    if time.monotonic() - ts > ttl:
        del _cache[key]
        return None
    return value


def _cache_set(key: str, value: Any):
    _cache[key] = (time.monotonic(), value)


def invalidate_cache():
    """Clear all cached HA data. Call after config changes."""
    _cache.clear()


# ---------------------------------------------------------------------------
# WebSocket helper
# ---------------------------------------------------------------------------

async def _ws_call(messages: list[dict]) -> list[Any]:
    """
    Open a WebSocket connection to HA, authenticate, send all messages,
    collect results, close. Returns a list of result payloads in order.

    Each message must include an `id` field. The function waits until it
    has received a result for every message ID before returning.
    """
    config = storage.load_config()
    ha_url = config.get("ha_url", "http://homeassistant.local:8123")
    ha_token = config.get("ha_token", "")

    if not ha_token:
        raise HAClientError("No HA token configured. Set ha_token in PistonCore config.")

    # Convert http(s):// to ws(s)://
    ws_url = ha_url.rstrip("/").replace("http://", "ws://").replace("https://", "wss://")
    ws_url += "/api/websocket"

    pending_ids = {m["id"] for m in messages}
    results: dict[int, Any] = {}

    try:
        async with websockets.connect(ws_url, open_timeout=10) as ws:
            # HA sends auth_required first
            auth_req = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            if auth_req.get("type") != "auth_required":
                raise HAClientError(f"Unexpected HA handshake: {auth_req}")

            # Authenticate
            await ws.send(json.dumps({"type": "auth", "access_token": ha_token}))
            auth_resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            if auth_resp.get("type") != "auth_ok":
                raise HAClientError("HA authentication failed. Check ha_token in config.")

            # Send all messages
            for msg in messages:
                await ws.send(json.dumps(msg))

            # Collect results
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


def _run(coro):
    """Run an async coroutine from sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already inside an async context (e.g. FastAPI) — run in thread pool
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result(timeout=30)
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


class HAClientError(Exception):
    """Raised when HA communication fails."""
    pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_devices() -> list[dict]:
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
    cached = _cache_get("devices", DEVICE_CACHE_TTL)
    if cached is not None:
        return cached

    result = _run(_fetch_devices())
    _cache_set("devices", result)
    return result


async def _fetch_devices() -> list[dict]:
    """Fetch entity list + area registry from HA, merge, return normalized list."""
    results = await _ws_call([
        {"id": 1, "type": "get_states"},
        {"id": 2, "type": "config/area_registry/list"},
        {"id": 3, "type": "config/entity_registry/list"},
    ])

    states_resp, areas_resp, entity_resp = results

    if not states_resp.get("success"):
        raise HAClientError("HA returned error for get_states.")

    # Build area_id -> area name map
    area_map: dict[str, str] = {}
    if areas_resp.get("success"):
        for area in areas_resp.get("result", []):
            area_map[area["area_id"]] = area["name"]

    # Build entity_id -> area_id + device_id map from entity registry
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
        attrs = state.get("attributes", {})
        friendly_name = attrs.get("friendly_name") or entity_id

        meta = entity_meta.get(entity_id, {})
        area_id = meta.get("area_id")
        area_name = area_map.get(area_id) if area_id else None

        devices.append({
            "entity_id": entity_id,
            "friendly_name": friendly_name,
            "domain": domain,
            "area": area_name,
            "device_id": meta.get("device_id"),
        })

    # Sort by friendly name, case-insensitive
    devices.sort(key=lambda d: d["friendly_name"].lower())
    return devices


def get_capabilities(entity_id: str) -> dict:
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
    cached = _cache_get(cache_key, CAPABILITY_CACHE_TTL)
    if cached is not None:
        return cached

    result = _run(_fetch_capabilities(entity_id))
    _cache_set(cache_key, result)
    return result


async def _fetch_capabilities(entity_id: str) -> dict:
    results = await _ws_call([
        {"id": 1, "type": "get_states"},
    ])
    states_resp = results[0]

    if not states_resp.get("success"):
        raise HAClientError("HA returned error for get_states.")

    # Find this entity
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

    # Build capability list — always includes "state" as first capability
    capabilities = []

    # Primary state capability
    state_cap = {
        "name": "state",
        "attribute_type": _detect_attribute_type(domain, device_class, attrs),
        "device_class": device_class,
        "unit": attrs.get("unit_of_measurement"),
        "options": attrs.get("options"),  # input_select / enum
    }
    capabilities.append(state_cap)

    # Additional numeric attributes worth exposing
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


def get_services(entity_id: str) -> list[dict]:
    """
    Return valid services for a device's domain with parameter schema.
    Result is cached per entity_id.

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
    cache_key = f"svc:{entity_id}"
    cached = _cache_get(cache_key, CAPABILITY_CACHE_TTL)
    if cached is not None:
        return cached

    result = _run(_fetch_services(entity_id))
    _cache_set(cache_key, result)
    return result


async def _fetch_services(entity_id: str) -> list[dict]:
    domain = entity_id.split(".")[0]

    results = await _ws_call([
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
            # Numeric constraints
            selector = field_data.get("selector", {})
            if "number" in selector:
                num = selector["number"]
                field["min"] = num.get("min")
                field["max"] = num.get("max")
                field["unit"] = num.get("unit_of_measurement")
                field["step"] = num.get("step", 1)
            # Options list for selects
            if "select" in selector:
                field["options"] = selector["select"].get("options", [])
            fields.append(field)

        output.append({
            "service": svc_name,
            "label": svc_data.get("name", svc_name.replace("_", " ").title()),
            "description": svc_data.get("description", ""),
            "fields": fields,
        })

    # Sort by label
    output.sort(key=lambda s: s["label"])
    return output


# ---------------------------------------------------------------------------
# Attribute type detection — WIZARD_SPEC priority order
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


def _detect_attribute_type(domain: str, device_class: str | None, attrs: dict) -> str:
    """
    Detect attribute type per WIZARD_SPEC detection priority order.
    Returns one of: binary, numeric, numeric_position, enum, ha_boolean,
                    location, unknown
    """
    # 1. Known binary device class
    if device_class and device_class in _BINARY_DEVICE_CLASSES:
        return "binary"

    # 2. Known numeric device class
    if device_class and device_class in _NUMERIC_DEVICE_CLASSES:
        return "numeric"

    # 3. unit_of_measurement present
    if attrs.get("unit_of_measurement"):
        return "numeric"

    # 4. options list (input_select, enum)
    if attrs.get("options"):
        return "enum"

    # 5. cover position
    if domain == "cover" and "current_position" in attrs:
        return "numeric_position"

    # 6. light brightness
    if domain == "light" and "brightness" in attrs:
        return "numeric_position"

    # 7. input_boolean
    if domain == "input_boolean":
        return "ha_boolean"

    # 8. person / device_tracker
    if domain in ("person", "device_tracker"):
        return "location"

    # 9. sensor with no unit — treat as enum using reported states
    if domain == "sensor":
        return "enum"

    # 10. fallback
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
