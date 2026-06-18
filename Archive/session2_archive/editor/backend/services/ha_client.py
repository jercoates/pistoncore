"""
Home Assistant API client.

All communication with HA goes through this module.
The editor never talks to HA directly — it goes through HAClient,
which handles auth, errors, and caching.
"""

import httpx
import logging
from typing import Any
from functools import lru_cache
import time

from core.config import settings

logger = logging.getLogger("pistoncore.ha_client")


class HAConnectionError(Exception):
    """Raised when PistonCore cannot reach Home Assistant."""
    pass


class HAAuthError(Exception):
    """Raised when the HA token is invalid or missing."""
    pass


class HAClient:
    def __init__(self):
        self._base_url = settings.ha_url.rstrip("/")
        self._token = settings.ha_token
        self._entity_cache: dict[str, Any] = {}
        self._entity_cache_ts: float = 0

    def _headers(self) -> dict:
        if not self._token:
            raise HAAuthError(
                "No Home Assistant token configured. "
                "Set PISTONCORE_HA_TOKEN in your environment."
            )
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    async def _get(self, path: str) -> Any:
        url = f"{self._base_url}/api{path}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=self._headers())
        except httpx.ConnectError:
            raise HAConnectionError(
                f"Could not connect to Home Assistant at {self._base_url}. "
                "Check that PISTONCORE_HA_URL is correct and HA is reachable."
            )
        except httpx.TimeoutException:
            raise HAConnectionError(
                f"Timed out connecting to Home Assistant at {self._base_url}."
            )

        if response.status_code == 401:
            raise HAAuthError(
                "Home Assistant rejected the token. "
                "Check that PISTONCORE_HA_TOKEN is a valid long-lived access token."
            )

        response.raise_for_status()
        return response.json()

    async def test_connection(self) -> dict:
        """Quick connectivity and auth check — used by the settings screen."""
        data = await self._get("/")
        return {
            "connected": True,
            "ha_version": data.get("version", "unknown"),
            "location_name": data.get("location_name", "Home"),
        }

    async def get_states(self) -> list[dict]:
        """
        Fetch all entity states from HA.
        Results are cached for entity_cache_ttl seconds to avoid
        hammering HA on every editor interaction.
        """
        now = time.monotonic()
        if self._entity_cache and (now - self._entity_cache_ts) < settings.entity_cache_ttl:
            logger.debug("Returning cached entity states")
            return list(self._entity_cache.values())

        logger.info("Fetching entity states from Home Assistant")
        states = await self._get("/states")
        self._entity_cache = {s["entity_id"]: s for s in states}
        self._entity_cache_ts = now
        return states

    async def get_state(self, entity_id: str) -> dict:
        """Fetch the current state of a single entity."""
        return await self._get(f"/states/{entity_id}")

    async def get_config(self) -> dict:
        """Fetch HA configuration (version, location, unit system, etc.)."""
        return await self._get("/config")

    async def get_services(self) -> dict:
        """Fetch all available HA services."""
        return await self._get("/services")

    async def get_areas(self) -> list[dict]:
        """Fetch all defined areas via the HA REST API."""
        # Areas are in the config/area_registry endpoint (requires companion integration)
        # For now, extract areas from entity states
        states = await self.get_states()
        areas = {}
        for state in states:
            area = state.get("attributes", {}).get("area_id")
            if area and area not in areas:
                areas[area] = {"area_id": area, "name": area.replace("_", " ").title()}
        return list(areas.values())

    def invalidate_cache(self):
        """Force the next get_states() call to fetch fresh data from HA."""
        self._entity_cache = {}
        self._entity_cache_ts = 0


# Single shared instance — all routes use this
ha_client = HAClient()
