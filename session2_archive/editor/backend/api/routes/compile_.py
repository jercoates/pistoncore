"""
/api/compile — Piston compilation and deployment.

This is where piston JSON gets turned into HA automation YAML or PyScript .py files.
The actual compilation logic lives in services/compiler/. This route is the entry point.
"""

from fastapi import APIRouter, HTTPException
from core.storage import get_piston
from services.compiler import compile_piston, CompileResult

router = APIRouter()


@router.post("/{piston_id}/preview")
async def preview_compile(piston_id: str):
    """
    Dry run — compile to the target format and return the output as a string.
    Nothing is written to disk or sent to HA.
    """
    piston = get_piston(piston_id)
    if not piston:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")

    result = compile_piston(piston)
    return {
        "target": result.target,
        "output": result.output,
        "filename": result.filename,
        "warnings": result.warnings,
    }


@router.post("/{piston_id}/deploy")
async def deploy_piston(piston_id: str):
    """
    Compile and deploy a piston to Home Assistant via the companion integration.
    Triggers a HA reload after writing the file.
    """
    piston = get_piston(piston_id)
    if not piston:
        raise HTTPException(status_code=404, detail=f"Piston '{piston_id}' not found.")

    result = compile_piston(piston)

    # TODO: Send result.output to companion integration for writing to HA config
    # This will be implemented in the companion integration phase.
    # For now, return the compiled output so the UI can show what would deploy.

    return {
        "status": "compiled",
        "target": result.target,
        "filename": result.filename,
        "warnings": result.warnings,
        "note": "Companion integration not yet connected — deploy will write files in a future session.",
    }
