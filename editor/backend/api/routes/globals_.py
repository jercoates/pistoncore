"""
/api/globals — Global variable management.
"""

from fastapi import APIRouter
from core.storage import load_globals, save_globals

router = APIRouter()


@router.get("")
async def get_globals():
    return load_globals()


@router.put("")
async def update_globals(globals_: list[dict]):
    save_globals(globals_)
    return {"status": "saved", "count": len(globals_)}
