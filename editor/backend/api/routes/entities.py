"""
/api/entities — HA entity data for the editor's dropdowns.

The frontend never talks to HA directly. It requests entity lists here
and gets back friendly-name data it can show in dropdowns.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.ha_client import ha_client, HAConnectionError, HAAuthError
from services.entity_service import state_to_entity, to_summary, group_by_domain
from models.entity import EntityListResponse, EntitySummary

router = APIRouter()


@router.get("", response_model=EntityListResponse)
async def list_entities(
    domain: Optional[str] = Query(None, description="Filter by domain (e.g. 'light', 'switch')"),
    area: Optional[str] = Query(None, description="Filter by area_id"),
    search: Optional[str] = Query(None, description="Search by friendly name"),
):
    """
    Return all HA entities available for use in pistons.
    Optionally filter by domain, area, or name search.
    """
    try:
        states = await ha_client.get_states()
    except HAAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except HAConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))

    entities = [state_to_entity(s) for s in states]

    # Apply filters
    if domain:
        entities = [e for e in entities if e.domain == domain]
    if area:
        entities = [e for e in entities if e.area_id == area]
    if search:
        q = search.lower()
        entities = [e for e in entities if q in e.friendly_name.lower()]

    summaries = [to_summary(e) for e in entities]
    grouped = group_by_domain(entities)

    return EntityListResponse(
        entities=summaries,
        grouped=grouped,
        total=len(summaries),
    )


@router.get("/domains")
async def list_domains():
    """Return the list of domains present in this HA instance."""
    try:
        states = await ha_client.get_states()
    except (HAAuthError, HAConnectionError) as e:
        raise HTTPException(status_code=503, detail=str(e))

    entities = [state_to_entity(s) for s in states]
    domains = sorted(set((e.domain, e.domain_label) for e in entities))
    return [{"domain": d, "label": l} for d, l in domains]


@router.get("/services")
async def list_services():
    """Return all HA services, for building call_service actions."""
    try:
        return await ha_client.get_services()
    except (HAAuthError, HAConnectionError) as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/refresh")
async def refresh_entities():
    """Force a fresh entity fetch from HA, bypassing the cache."""
    ha_client.invalidate_cache()
    return {"status": "cache cleared"}
