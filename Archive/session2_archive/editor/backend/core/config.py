"""
PistonCore configuration — loaded from environment variables at startup.
Set these in your Docker Compose or Unraid template.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Home Assistant connection
    ha_url: str = "http://homeassistant.local:8123"
    ha_token: str = ""  # Long-lived access token

    # PistonCore server
    host: str = "0.0.0.0"
    port: int = 7777
    debug: bool = False

    # Storage — path inside the container, mounted as a Docker volume
    data_dir: str = "/data"

    # HA entity cache TTL in seconds (refresh from HA periodically)
    entity_cache_ttl: int = 300

    class Config:
        env_prefix = "PISTONCORE_"
        env_file = ".env"


settings = Settings()
