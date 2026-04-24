# pistoncore/backend/api.py
#
# PistonCore REST API endpoints.
# All routes are collected in a single router included by main.py.
#
# Endpoint summary:
#   GET    /pistons                  — list all pistons
#   GET    /pistons/{id}             — get one piston
#   POST   /pistons                  — create piston
#   PUT    /pistons/{id}             — update piston
#   DELETE /pistons/{id}             — delete piston
#   POST   /pistons/{id}/compile     — compile piston, return YAML strings
#   POST   /pistons/{id}/deploy      — compile + send to companion for HA write
#   GET    /globals                  — list global variables
#   POST   /globals                  — create global variable
#   DELETE /globals/{id}             — delete global variable
#   GET    /config                   — get runtime config
#   PUT    /config                   — update runtime config
#   GET    /health                   — health check

import os

from fastapi import APIRouter, Depends, HTTPException, Security, Body
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import Any

import storage
from compiler import Compiler, CompilerError

# ---------------------------------------------------------------------------
# API key authentication
# Protects all endpoints with a shared secret.
# Set PISTONCORE_API_KEY in docker-compose.yml before exposing beyond localhost.
# Send as request header:  X-API-Key: <your-key>
# If the env var is not set, the check is skipped (dev/test convenience only).
# ---------------------------------------------------------------------------

_API_KEY = os.environ.get("PISTONCORE_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _verify_api_key(key: str | None = Security(_api_key_header)) -> None:
    if not _API_KEY:
        return  # no key configured -- open access, dev/test only
    if key != _API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


router = APIRouter(dependencies=[Depends(_verify_api_key)])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_compiler() -> Compiler:
    config = storage.load_config()
    return Compiler(template_dir=config["template_dir"])


def _get_app_version() -> str:
    return storage.load_config().get("app_version", "0.9")


def _compile(piston: dict) -> dict:
    """
    Run the compiler against a piston and its device_map.
    Returns a dict with automation_yaml, script_yaml, warnings, errors.
    """
    compiler = _get_compiler()
    device_map = piston.get("device_map", {})
    globals_store = storage.load_globals()
    known_slugs = storage.get_all_slugs()
    app_version = _get_app_version()

    auto_yaml, script_yaml, warnings, errors = compiler.compile_piston(
        piston=piston,
        device_map=device_map,
        globals_store=globals_store,
        app_version=app_version,
        known_piston_slugs=known_slugs,
    )

    return {
        "automation_yaml": auto_yaml,
        "script_yaml": script_yaml,
        "warnings": [str(w) for w in warnings],
        "errors": errors,
        "success": len(errors) == 0,
    }


# ---------------------------------------------------------------------------
# Piston endpoints
# ---------------------------------------------------------------------------

@router.get("/pistons")
def list_pistons():
    """List all pistons. Returns name, id, mode, updated_at — not full JSON."""
    pistons = storage.list_pistons()
    return [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "description": p.get("description", ""),
            "mode": p.get("mode", "single"),
            "folder": p.get("folder", ""),
            "updated_at": p.get("updated_at"),
            "created_at": p.get("created_at"),
            "deployed": p.get("deployed", False),
            "stale": p.get("stale", False),
        }
        for p in pistons
    ]


@router.get("/pistons/{piston_id}")
def get_piston(piston_id: str):
    """Get the full piston JSON for a single piston."""
    piston = storage.get_piston(piston_id)
    if piston is None:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")
    return piston


@router.post("/pistons", status_code=201)
def create_piston(piston: dict = Body(...)):
    """
    Create a new piston. Assigns an ID and timestamps.
    Returns the saved piston.
    """
    # Don't allow the client to set an ID on create
    piston.pop("id", None)
    saved = storage.save_piston(piston)
    return saved


@router.put("/pistons/{piston_id}")
def update_piston(piston_id: str, piston: dict = Body(...)):
    """
    Update an existing piston. The piston_id in the URL is authoritative.
    Runs internal validation (compile check) on save — does NOT deploy.
    Returns the saved piston plus any compiler warnings.
    """
    existing = storage.get_piston(piston_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")

    piston["id"] = piston_id  # enforce ID from URL
    saved = storage.save_piston(piston)

    # Run compile check on save (Stage 1 + 2 validation — no HA write)
    compile_result = _compile(saved)

    return {
        "piston": saved,
        "compile_check": compile_result,
    }


@router.delete("/pistons/{piston_id}", status_code=204)
def delete_piston(piston_id: str):
    """
    Delete a piston from storage.
    Does NOT remove compiled files from HA — that is the companion's job.
    The frontend should warn the user that deployed files must be cleaned up manually
    or via the companion before deletion if the piston is deployed.
    """
    deleted = storage.delete_piston(piston_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")


# ---------------------------------------------------------------------------
# Compile endpoint
# ---------------------------------------------------------------------------

@router.post("/pistons/{piston_id}/compile")
def compile_piston(piston_id: str):
    """
    Compile a piston and return the YAML strings.
    Does NOT write anything to HA. Safe to call any time.
    Use this to preview compiled output before deploying.
    """
    piston = storage.get_piston(piston_id)
    if piston is None:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")

    result = _compile(piston)
    return result


# ---------------------------------------------------------------------------
# Deploy endpoint
# ---------------------------------------------------------------------------

@router.post("/pistons/{piston_id}/deploy")
def deploy_piston(piston_id: str):
    """
    Compile a piston and send the output to the companion for writing to HA.
    The companion writes the files and reloads automations/scripts.

    This is the two-step save model:
      Step 1: PUT /pistons/{id}  — saves JSON to Docker volume (always fast)
      Step 2: POST /pistons/{id}/deploy  — compiles + writes to HA via companion

    Returns compile result plus companion response.
    """
    piston = storage.get_piston(piston_id)
    if piston is None:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")

    compile_result = _compile(piston)

    if not compile_result["success"]:
        return {
            "deployed": False,
            "reason": "Compilation failed — nothing written to HA.",
            "compile_result": compile_result,
        }

    # Send to companion
    companion_result = _send_to_companion(piston, compile_result)

    if companion_result["success"]:
        # Mark piston as deployed
        piston["deployed"] = True
        piston["stale"] = False
        storage.save_piston(piston)

    return {
        "deployed": companion_result["success"],
        "compile_result": compile_result,
        "companion": companion_result,
    }


def _send_to_companion(piston: dict, compile_result: dict) -> dict:
    """
    Send compiled YAML to the companion integration for writing to HA.
    The companion is a HA custom integration that:
      - Writes automation and script YAML files
      - Calls automation.reload and script.reload
      - Manages global variable helpers

    Companion communication: REST call to HA's companion service endpoint.
    This is a stub — full companion integration is a separate spec/session.
    """
    # TODO: implement companion HTTP call
    # config = storage.load_config()
    # ha_url = config["ha_url"]
    # ha_token = config["ha_token"]
    # POST to {ha_url}/api/services/pistoncore/deploy with the YAML strings

    return {
        "success": False,
        "message": "Companion not yet implemented. "
                   "Compile output is ready — deploy stub will be replaced in a future session.",
        "automation_yaml": compile_result["automation_yaml"],
        "script_yaml": compile_result["script_yaml"],
    }


# ---------------------------------------------------------------------------
# Globals endpoints
# ---------------------------------------------------------------------------

@router.get("/globals")
def list_globals():
    """List all global variables."""
    return storage.load_globals()


@router.post("/globals", status_code=201)
def create_global(body: dict = Body(...)):
    """
    Create a global variable.
    Body: { "display_name": str, "type": "Text"|"Number"|"Yes/No"|"Date/Time" }
    The companion creates the corresponding HA helper on deploy.
    """
    globals_store = storage.load_globals()
    import uuid
    global_id = str(uuid.uuid4()).replace("-", "")[:8]
    globals_store[global_id] = {
        "id": global_id,
        "display_name": body.get("display_name", "New Variable"),
        "type": body.get("type", "Text"),
    }
    storage.save_globals(globals_store)
    return globals_store[global_id]


@router.delete("/globals/{global_id}", status_code=204)
def delete_global(global_id: str):
    """
    Delete a global variable from the store.
    The companion removes the corresponding HA helper.
    Pistons referencing this global are marked stale.
    """
    globals_store = storage.load_globals()
    if global_id not in globals_store:
        raise HTTPException(status_code=404, detail=f"Global '{global_id}' not found.")
    del globals_store[global_id]
    storage.save_globals(globals_store)

    # Mark all pistons that reference this global as stale
    _mark_pistons_stale_for_global(global_id)


def _mark_pistons_stale_for_global(global_id: str):
    """Mark any piston referencing the deleted global as stale."""
    for piston in storage.list_pistons():
        piston_json = str(piston)
        if global_id in piston_json or f"@" in piston_json:
            # Simple heuristic — full scan would walk the piston tree
            piston["stale"] = True
            storage.save_piston(piston)


# ---------------------------------------------------------------------------
# Config endpoints
# ---------------------------------------------------------------------------

@router.get("/config")
def get_config():
    """Get runtime config. Redacts the HA token."""
    config = storage.load_config()
    redacted = dict(config)
    if redacted.get("ha_token"):
        redacted["ha_token"] = "***"
    return redacted


@router.put("/config")
def update_config(body: dict = Body(...)):
    """Update runtime config. Merges with existing config."""
    config = storage.load_config()
    config.update(body)
    storage.save_config(config)
    return {"saved": True}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@router.get("/health")
def health():
    """Health check endpoint. Returns ok if the backend is running."""
    return {"status": "ok"}
