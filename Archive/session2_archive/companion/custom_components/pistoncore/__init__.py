"""
PistonCore Companion Integration for Home Assistant.

This integration provides a local API that the PistonCore editor uses to:
  1. Write compiled piston files to the HA config directory
  2. Trigger automation/script reloads after deployment
  3. Report entity, device, area, and service data back to the editor
     (as an alternative to direct HA API calls from the editor)

Install via HACS. Requires a long-lived access token configured in PistonCore settings.
"""

import logging
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform

from .const import DOMAIN
from .api import async_register_api

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = []


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up PistonCore from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # Register the local HTTP API endpoints
    await async_register_api(hass, entry)

    _LOGGER.info("PistonCore companion integration loaded")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload PistonCore config entry."""
    hass.data[DOMAIN].pop(entry.entry_id)
    return True
