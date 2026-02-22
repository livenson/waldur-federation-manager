"""GET /federation/historical_keys — Historical JWK Set."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity
from app.database import get_session
from app.keys.manager import get_historical_jwks

router = APIRouter()


@router.get("/federation/historical_keys")
async def historical_keys(
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Return the historical JWK Set (includes rotated/revoked keys)."""
    settings = get_settings()

    result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    anchor = result.scalars().first()
    if not anchor:
        return {"keys": []}

    return await get_historical_jwks(session, anchor.id)
