"""
/api/settings — PistonCore app settings (HA URL, token, etc.)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.storage import load_settings, save_settings
from services.ha_client import ha_client, HAConnectionError, HAAuthError

router = APIRouter()


class SettingsUpdate(BaseModel):
    ha_url: str
    ha_token: str


@router.get("")
async def get_settings():
    data = load_settings()
    # Never return the token — return a masked indicator only
    return {
        "ha_url": data.get("ha_url", ""),
        "ha_token_set": bool(data.get("ha_token", "")),
    }


@router.put("")
async def update_settings(update: SettingsUpdate):
    save_settings({"ha_url": update.ha_url, "ha_token": update.ha_token})
    # Update the live client
    ha_client._base_url = update.ha_url.rstrip("/")
    ha_client._token = update.ha_token
    ha_client.invalidate_cache()
    return {"status": "saved"}


@router.get("/test-connection")
async def test_connection():
    """Test the current HA connection and return version/location info."""
    try:
        result = await ha_client.test_connection()
        return result
    except HAAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except HAConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
