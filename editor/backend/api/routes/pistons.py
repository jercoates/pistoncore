"""
/api/pistons — CRUD for pistons.
"""

from fastapi import APIRouter, HTTPException
from models.piston import Piston, PistonSummary, PistonImportRequest
from core.storage import (
    list_pistons, get_piston, save_piston, delete_piston, import_piston
)

router = APIRouter()


@router.get("", response_model=list[PistonSummary])
async def get_pistons():
    """Return summary list of all pistons (for the piston list screen)."""
    return list_pistons()


@router.get("/{piston_id}", response_model=Piston)
async def get_piston_by_id(piston_id: str):
    piston = get_piston(piston_id)
    if not piston:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")
    return piston


@router.post("", response_model=Piston)
async def create_piston(piston: Piston):
    """Create a new piston. ID is assigned by the server."""
    piston.id = None  # Force new ID assignment
    return save_piston(piston)


@router.put("/{piston_id}", response_model=Piston)
async def update_piston(piston_id: str, piston: Piston):
    """Save changes to an existing piston."""
    existing = get_piston(piston_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")
    piston.id = piston_id
    return save_piston(piston)


@router.delete("/{piston_id}")
async def remove_piston(piston_id: str):
    if not delete_piston(piston_id):
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")
    return {"status": "deleted", "id": piston_id}


@router.post("/import", response_model=Piston)
async def import_piston_route(request: PistonImportRequest):
    """
    Import a shared piston JSON.
    The device_map from the request (user's role assignments) is merged in.
    """
    data = request.piston_data
    data["device_map"] = request.device_map
    return import_piston(data)


@router.post("/{piston_id}/toggle")
async def toggle_piston(piston_id: str):
    """Enable or disable a piston without opening the editor."""
    piston = get_piston(piston_id)
    if not piston:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")
    piston.enabled = not piston.enabled
    save_piston(piston)
    return {"id": piston_id, "enabled": piston.enabled}
