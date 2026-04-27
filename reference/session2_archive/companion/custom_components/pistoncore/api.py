"""
PistonCore companion HTTP API.

The editor calls these endpoints to:
  - Write compiled piston files to the HA config directory
  - Trigger reloads
  - Verify the companion is reachable

All endpoints require the shared editor token in the Authorization header.
"""

import logging
import os
from pathlib import Path

from aiohttp import web
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components.http import HomeAssistantView

from .const import DOMAIN, CONF_EDITOR_TOKEN, API_BASE, AUTOMATIONS_DIR, PYSCRIPT_DIR

_LOGGER = logging.getLogger(__name__)


async def async_register_api(hass: HomeAssistant, entry: ConfigEntry):
    """Register PistonCore API views with the HA HTTP component."""
    token = entry.data.get(CONF_EDITOR_TOKEN, "")
    hass.http.register_view(PistoncoreHealthView(token))
    hass.http.register_view(PistoncoreDeployView(hass, token))
    hass.http.register_view(PistoncoreDeleteView(hass, token))


def _check_auth(request: web.Request, token: str) -> bool:
    auth = request.headers.get("Authorization", "")
    return auth == f"Bearer {token}"


class PistoncoreHealthView(HomeAssistantView):
    """GET /api/pistoncore/health — confirm companion is alive."""
    url = f"{API_BASE}/health"
    name = "api:pistoncore:health"
    requires_auth = False  # Auth handled manually via shared token

    def __init__(self, token: str):
        self._token = token

    async def get(self, request: web.Request) -> web.Response:
        if not _check_auth(request, self._token):
            return web.Response(status=401, text="Unauthorized")
        return web.json_response({"status": "ok", "domain": DOMAIN})


class PistoncoreDeployView(HomeAssistantView):
    """
    POST /api/pistoncore/deploy
    Body: { "filename": "...", "target": "yaml|pyscript", "content": "..." }
    
    Writes the compiled file and triggers a HA reload.
    PistonCore ONLY writes to its own subdirectories — never anywhere else.
    """
    url = f"{API_BASE}/deploy"
    name = "api:pistoncore:deploy"
    requires_auth = False

    def __init__(self, hass: HomeAssistant, token: str):
        self._hass = hass
        self._token = token

    async def post(self, request: web.Request) -> web.Response:
        if not _check_auth(request, self._token):
            return web.Response(status=401, text="Unauthorized")

        try:
            data = await request.json()
            filename = data["filename"]
            target = data["target"]  # "yaml" or "pyscript"
            content = data["content"]
        except (KeyError, ValueError) as e:
            return web.Response(status=400, text=f"Invalid request: {e}")

        # Determine output path — always within PistonCore's own subfolders
        config_dir = self._hass.config.config_dir
        if target == "yaml":
            out_dir = Path(config_dir) / AUTOMATIONS_DIR
            suffix = ".yaml"
        else:
            out_dir = Path(config_dir) / PYSCRIPT_DIR
            suffix = ".py"

        out_dir.mkdir(parents=True, exist_ok=True)

        # Safety check: filename must not escape the output directory
        safe_name = Path(filename).name  # Strip any path components
        if not safe_name.endswith(suffix):
            safe_name = safe_name.rsplit(".", 1)[0] + suffix

        out_path = out_dir / safe_name

        # Write the file
        out_path.write_text(content, encoding="utf-8")
        _LOGGER.info(f"PistonCore deployed: {out_path}")

        # Trigger HA reload
        if target == "yaml":
            await self._hass.services.async_call("automation", "reload")
        else:
            # PyScript reload if pyscript integration is installed
            if self._hass.services.has_service("pyscript", "reload"):
                await self._hass.services.async_call("pyscript", "reload")

        return web.json_response({
            "status": "deployed",
            "path": str(out_path),
            "target": target,
        })


class PistoncoreDeleteView(HomeAssistantView):
    """
    DELETE /api/pistoncore/deploy
    Body: { "filename": "...", "target": "yaml|pyscript" }

    Removes a deployed piston file and triggers a reload.
    Only deletes files within PistonCore's own subdirectories.
    """
    url = f"{API_BASE}/deploy"
    name = "api:pistoncore:delete"
    requires_auth = False

    def __init__(self, hass: HomeAssistant, token: str):
        self._hass = hass
        self._token = token

    async def delete(self, request: web.Request) -> web.Response:
        if not _check_auth(request, self._token):
            return web.Response(status=401, text="Unauthorized")

        try:
            data = await request.json()
            filename = data["filename"]
            target = data["target"]
        except (KeyError, ValueError) as e:
            return web.Response(status=400, text=f"Invalid request: {e}")

        config_dir = self._hass.config.config_dir
        if target == "yaml":
            out_dir = Path(config_dir) / AUTOMATIONS_DIR
        else:
            out_dir = Path(config_dir) / PYSCRIPT_DIR

        safe_name = Path(filename).name
        out_path = out_dir / safe_name

        if not out_path.exists():
            return web.Response(status=404, text="File not found")

        out_path.unlink()
        _LOGGER.info(f"PistonCore removed: {out_path}")

        if target == "yaml":
            await self._hass.services.async_call("automation", "reload")

        return web.json_response({"status": "deleted", "path": str(out_path)})
