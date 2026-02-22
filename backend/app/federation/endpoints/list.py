"""GET /federation/list — List subordinate entities."""

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus, SubordinateStatement
from app.database import get_session

router = APIRouter()


@router.get("/federation/list")
async def list_subordinates(
    entity_type: str | None = Query(None, description="Filter by entity type"),
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    """List entity_ids of all active subordinate entities.

    Returns a JSON array of entity_id strings.
    """
    settings = get_settings()

    # Find all entities that have a current subordinate statement issued by the TA
    query = (
        select(SubordinateStatement.subject_entity_id)
        .where(
            SubordinateStatement.issuer_entity_id == settings.entity_id,
            SubordinateStatement.is_current == True,  # noqa: E712
        )
    )
    result = await session.execute(query)
    subject_ids = [row[0] for row in result.all()]

    if not entity_type or not subject_ids:
        return subject_ids

    # Filter by entity type if requested
    filtered = []
    for eid in subject_ids:
        entity_result = await session.execute(
            select(Entity).where(Entity.entity_id == eid)
        )
        entity = entity_result.scalars().first()
        if entity:
            types = json.loads(entity.entity_types) if entity.entity_types else []
            if entity_type in types:
                filtered.append(eid)
    return filtered
