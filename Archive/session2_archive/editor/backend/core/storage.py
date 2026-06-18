"""
Piston storage service.

Pistons are stored as individual JSON files under:
  /data/pistons/<piston_id>.json

The data directory is a Docker volume that persists across container updates.
This module is the only place that touches the filesystem for pistons.
"""

import json
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone

from core.config import settings
from models.piston import Piston, PistonSummary

logger = logging.getLogger("pistoncore.storage")

PISTONS_DIR = Path(settings.data_dir) / "pistons"
GLOBALS_FILE = Path(settings.data_dir) / "globals.json"
SETTINGS_FILE = Path(settings.data_dir) / "settings.json"


def init_storage():
    """Called at startup — ensure data directories exist."""
    PISTONS_DIR.mkdir(parents=True, exist_ok=True)
    if not GLOBALS_FILE.exists():
        GLOBALS_FILE.write_text(json.dumps([], indent=2))
    if not SETTINGS_FILE.exists():
        SETTINGS_FILE.write_text(json.dumps({
            "ha_url": "",
            "ha_token": "",
        }, indent=2))
    logger.info(f"Storage initialized at {settings.data_dir}")


# ── Pistons ──────────────────────────────────────────────────────────────────

def list_pistons() -> list[PistonSummary]:
    summaries = []
    for f in sorted(PISTONS_DIR.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            summaries.append(PistonSummary(
                id=data["id"],
                name=data["name"],
                description=data.get("description", ""),
                folder=data.get("folder", ""),
                enabled=data.get("enabled", True),
                mode=data.get("mode", "single"),
                last_modified=data.get("last_modified"),
            ))
        except Exception as e:
            logger.warning(f"Could not read piston file {f.name}: {e}")
    return summaries


def get_piston(piston_id: str) -> Piston | None:
    path = PISTONS_DIR / f"{piston_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return Piston(**data)


def save_piston(piston: Piston) -> Piston:
    if not piston.id:
        piston.id = str(uuid.uuid4())[:8]
    piston.last_modified = datetime.now(timezone.utc).isoformat()
    path = PISTONS_DIR / f"{piston.id}.json"
    path.write_text(json.dumps(piston.model_dump(), indent=2))
    logger.info(f"Saved piston: {piston.name} ({piston.id})")
    return piston


def delete_piston(piston_id: str) -> bool:
    path = PISTONS_DIR / f"{piston_id}.json"
    if not path.exists():
        return False
    path.unlink()
    logger.info(f"Deleted piston: {piston_id}")
    return True


def import_piston(data: dict) -> Piston:
    """
    Import a piston from shared JSON.
    Assigns a new local ID so it doesn't collide with existing pistons.
    The device_map is cleared — user will be prompted to map roles on import.
    """
    data["id"] = str(uuid.uuid4())[:8]
    data["device_map"] = {}  # Cleared — must be remapped to local entities
    piston = Piston(**data)
    return save_piston(piston)


# ── Globals ───────────────────────────────────────────────────────────────────

def load_globals() -> list[dict]:
    return json.loads(GLOBALS_FILE.read_text())


def save_globals(globals_: list[dict]):
    GLOBALS_FILE.write_text(json.dumps(globals_, indent=2))


# ── App settings ──────────────────────────────────────────────────────────────

def load_settings() -> dict:
    return json.loads(SETTINGS_FILE.read_text())


def save_settings(data: dict):
    SETTINGS_FILE.write_text(json.dumps(data, indent=2))
