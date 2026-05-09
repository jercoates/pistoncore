# pistoncore/backend/api.py
#
# PistonCore REST API endpoints.
# All routes are collected in a single router included by main.py.
#
# Endpoint summary:
#   GET    /pistons                        — list all pistons
#   GET    /pistons/{id}                   — get one piston
#   POST   /pistons                        — create piston
#   PUT    /pistons/{id}                   — update piston
#   DELETE /pistons/{id}                   — delete piston
#   POST   /pistons/{id}/compile           — compile piston, return YAML strings
#   POST   /pistons/{id}/deploy            — compile + send to companion for HA write
#   GET    /globals                        — list global variables
#   POST   /globals                        — create global variable
#   DELETE /globals/{id}                   — delete global variable
#   GET    /config                         — get runtime config
#   PUT    /config                         — update runtime config (clears HA cache)
#   GET    /health                         — health check
#   GET    /devices                        — all HA entities (cached 60s)
#   GET    /devices/refresh                — force cache refresh
#   GET    /device/{entity_id}/capabilities — capabilities with attribute_type detection
#   GET    /device/{entity_id}/services    — domain services with field schema

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Security, Body
from fastapi.security import APIKeyHeader

import storage
from compiler import Compiler
import ha_client
from ha_client import HAClientError

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
    Run the compiler against a piston and return a structured result.
    Builds the fat context dict per COMPILER_SPEC Section 7.
    Returns a dict with automation_yaml, script_yaml, warnings, errors, success.

    Stub fields (entity_states, services, ha_version, zones, areas) are populated
    with empty defaults until S1-6 implements context_builder.py.
    """
    compiler = _get_compiler()
    context = {
        "piston":           piston,
        "device_map":       piston.get("device_map", {}),
        "globals_store":    storage.load_globals(),
        "known_piston_ids": storage.get_all_slugs(),   # {piston_id: slug}
        "app_version":      _get_app_version(),
        # Stub fields — real values assembled in S1-6 (context_builder.py)
        "entity_states":    {},
        "services":         {},
        "ha_version":       "unknown",
        "zones":            [],
        "areas":            [],
    }

    try:
        result = compiler.compile_piston(context)
    except Exception as e:
        # compile_piston() catches CompilerError internally and never re-raises it.
        # This catches Jinja2 TemplateError and any other unexpected failure (GAP-S29-13).
        return {
            "automation_yaml": None,
            "script_yaml":     None,
            "warnings":        [],
            "errors":          [{"level": "error", "code": "COMPILER_INTERNAL_ERROR", "message": str(e), "context": None}],
            "success":         False,
        }

    return {
        "automation_yaml": result.automation_yaml,
        "script_yaml":     result.script_yaml,
        "warnings":        [{"level": m.level, "code": m.code, "message": m.message, "context": m.context} for m in result.warnings],
        "errors":          [{"level": m.level, "code": m.code, "message": m.message, "context": m.context} for m in result.errors],
        "success":         len(result.errors) == 0,
    }


# ---------------------------------------------------------------------------
# Piston helpers
# ---------------------------------------------------------------------------

def _migrate_piston(piston: dict) -> dict:
    """
    Schema migration hook. Pass-through for now — no migrations defined yet.
    When logic_version bumps, add migration steps here keyed by version number.
    Called on every GET /pistons/{id} before the version check.
    """
    return piston


def _validate_device_map(device_map: dict) -> dict:
    """
    Coerce device_map values to lists. Per PISTON_FORMAT.md, all role values
    must be arrays of entity ID strings — never bare strings.
    Raises 422 if a value cannot be coerced to a list.
    """
    cleaned = {}
    for role, value in device_map.items():
        if isinstance(value, list):
            cleaned[role] = value
        elif isinstance(value, str):
            cleaned[role] = [value]   # coerce bare string to single-item list
        else:
            raise HTTPException(
                status_code=422,
                detail=f"device_map role '{role}' must be a list of entity IDs.",
            )
    return cleaned


# ---------------------------------------------------------------------------
# Piston endpoints
# ---------------------------------------------------------------------------

@router.get("/pistons")
def list_pistons():
    """List all pistons. Returns name, id, mode, modified_at — not full JSON."""
    pistons = storage.list_pistons()
    return [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "description": p.get("description", ""),
            "mode": p.get("mode", "single"),
            "folder": p.get("folder", ""),
            "modified_at": p.get("modified_at"),
            "created_at": p.get("created_at"),
            "deployed": p.get("deployed", False),
            "stale": p.get("stale", False),
        }
        for p in pistons
    ]


CURRENT_LOGIC_VERSION = 1
CURRENT_UI_VERSION = 1


@router.get("/pistons/{piston_id}")
def get_piston(piston_id: str):
    """Get the full piston JSON for a single piston."""
    piston = storage.get_piston(piston_id)
    if piston is None:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")

    piston = _migrate_piston(piston)  # schema migration hook (GAP-S29-12)

    # Spec: if logic_version or ui_version is from the future, refuse to load.
    # Treat missing version fields as v1 (safe default per spec).
    logic_v = piston.get("logic_version", 1)
    ui_v = piston.get("ui_version", 1)
    if logic_v > CURRENT_LOGIC_VERSION:
        raise HTTPException(
            status_code=409,
            detail=f"Piston '{piston_id}' was created with a newer logic version "
                   f"({logic_v}) than this PistonCore supports ({CURRENT_LOGIC_VERSION}). "
                   f"Update PistonCore before opening this piston.",
        )
    if ui_v > CURRENT_UI_VERSION:
        raise HTTPException(
            status_code=409,
            detail=f"Piston '{piston_id}' was created with a newer UI version "
                   f"({ui_v}) than this PistonCore supports ({CURRENT_UI_VERSION}). "
                   f"Update PistonCore before opening this piston.",
        )

    return piston


@router.post("/pistons", status_code=201)
def create_piston(piston: dict = Body(...)):
    """
    Create a new piston. Assigns an ID and timestamps.
    Returns the saved piston.
    """
    # Don't allow the client to set an ID or compile_target on create
    piston.pop("id", None)
    piston.pop("compile_target", None)  # compiler owns this — never user-supplied

    # Apply spec-required defaults for any fields the client omitted
    piston.setdefault("name", "Untitled Piston")
    piston.setdefault("description", "")
    piston.setdefault("folder", None)
    piston.setdefault("mode", "single")
    piston.setdefault("enabled", True)
    piston.setdefault("logic_version", 1)
    piston.setdefault("ui_version", 1)
    piston.setdefault("device_map", {})
    piston.setdefault("device_map_meta", {})
    piston.setdefault("variables", [])
    piston.setdefault("statements", [])
    piston["device_map"] = _validate_device_map(piston["device_map"])
    # piston_text stored as-is but never parsed — frontend render functions are
    # the source of truth for display text (PISTON_FORMAT.md Section 1, GAP-S29-16)
    saved = storage.save_piston(piston)
    return saved


@router.put("/pistons/{piston_id}")
def update_piston(piston_id: str, piston: dict = Body(...)):
    """
    Update an existing piston. The piston_id in the URL is authoritative.
    Does NOT compile on save — compile is a separate explicit action per
    DESIGN.md Section 18. Save is always fast and never blocked by compiler state.
    Returns the saved piston.
    """
    existing = storage.get_piston(piston_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")

    piston["id"] = piston_id  # enforce ID from URL
    piston.pop("compile_target", None)  # compiler owns this — never user-supplied
    piston["device_map"] = _validate_device_map(piston.get("device_map", {}))
    # piston_text stored as-is but never parsed — frontend render functions are
    # the source of truth for display text (PISTON_FORMAT.md Section 1, GAP-S29-16)
    saved = storage.save_piston(piston)
    return {"piston": saved}


@router.delete("/pistons/{piston_id}", status_code=204)
def delete_piston(piston_id: str):
    """
    Delete a piston from storage.
    Does NOT remove compiled files from HA — HA file cleanup must be done
    manually or will be handled by the deploy system in S1-5.
    The frontend should warn the user if the piston is currently deployed.
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
    Compile a piston and write the output directly to HA via ha_client.
    Full HA write implementation in S1-5. Returns compile result for now.

    This is the two-step save model:
      Step 1: PUT /pistons/{id}  — saves JSON to Docker volume (always fast)
      Step 2: POST /pistons/{id}/deploy  — compiles + writes to HA
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

    # TODO S1-5: write compiled YAML to HA via ha_client, call reload endpoints
    return {
        "deployed": False,
        "reason": "Deploy not yet implemented — compile succeeded. See S1-5.",
        "compile_result": compile_result,
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
        # FRAGILE HEURISTIC: string scan of serialized piston dict.
        # Produces false positives if global_id appears in unrelated text fields.
        # Real fix: walk piston statement tree checking global_id references.
        # See GAP-S29-15 — full fix in S4-8.
        if global_id in piston_json:
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
    # Invalidate HA cache — ha_url or ha_token may have changed
    ha_client.invalidate_cache()
    return {"saved": True}


# ---------------------------------------------------------------------------
# HA device endpoints
# ---------------------------------------------------------------------------

@router.get("/devices")
def list_devices():
    """
    Return all HA entities with friendly name, area, and domain.
    Result is cached for 60 seconds.

    Response: list of {
      entity_id, friendly_name, domain, area (nullable), device_id (nullable)
    }

    Raises 503 if HA is unreachable or token is not configured.
    """
    try:
        return ha_client.get_devices()
    except HAClientError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/devices/refresh")
def refresh_device_cache():
    """
    Invalidate the HA device/capability cache and force a fresh fetch.
    Call this after pairing new devices in HA or changing ha_url/ha_token.
    """
    ha_client.invalidate_cache()
    try:
        devices = ha_client.get_devices()
        return {"refreshed": True, "device_count": len(devices)}
    except HAClientError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/device/{entity_id:path}/capabilities")
def get_device_capabilities(entity_id: str):
    """
    Return capabilities for a single entity, with attribute_type detection
    per WIZARD_SPEC priority order.

    entity_id must be the full HA entity ID, e.g. "binary_sensor.front_door".
    Use entity_id:path to allow dots and slashes in the path segment.

    Response: {
      entity_id, state, domain, device_class,
      capabilities: [{ name, attribute_type, device_class, unit, options }]
    }
    """
    try:
        return ha_client.get_capabilities(entity_id)
    except HAClientError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/device/{entity_id:path}/services")
def get_device_services(entity_id: str):
    """
    Return all services available for a device's domain, with parameter schema.
    Used by the wizard action step to populate the service picker.

    Response: list of {
      service, label, description,
      fields: [{ name, label, description, type, required, min?, max?, unit?, options? }]
    }
    """
    try:
        return ha_client.get_services(entity_id)
    except HAClientError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ---------------------------------------------------------------------------
# Piston duplicate / import / export stubs
# ---------------------------------------------------------------------------

@router.post("/pistons/{piston_id}/duplicate", status_code=501)
def duplicate_piston(piston_id: str):
    """Duplicate a piston. Not yet implemented — returns 501. See S2-x."""
    raise HTTPException(status_code=501, detail="Duplicate not yet implemented.")


@router.post("/pistons/import", status_code=501)
def import_piston():
    """Import a piston from Snapshot JSON. Not yet implemented — returns 501. See S2-x."""
    raise HTTPException(status_code=501, detail="Import not yet implemented.")


@router.get("/pistons/{piston_id}/export", status_code=501)
def export_piston(piston_id: str):
    """Export a piston as Snapshot JSON. Not yet implemented — returns 501. See S2-x."""
    raise HTTPException(status_code=501, detail="Export not yet implemented.")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@router.get("/health")
def health():
    """Health check endpoint. Returns ok if the backend is running."""
    return {"status": "ok"}
