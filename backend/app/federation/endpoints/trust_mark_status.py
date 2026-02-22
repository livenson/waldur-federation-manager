"""GET /federation/trust_mark_status — Check trust mark status."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models.trust_mark import TrustMark, TrustMarkStatus
from app.database import get_session

router = APIRouter()


@router.get("/federation/trust_mark_status")
async def trust_mark_status(
    sub: str = Query(..., description="Subject entity_id"),
    trust_mark_id: str = Query(..., alias="id", description="Trust mark identifier"),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Check if a trust mark is currently active for a subject."""
    result = await session.execute(
        select(TrustMark).where(
            TrustMark.subject_entity_id == sub,
            TrustMark.trust_mark_id == trust_mark_id,
            TrustMark.status == TrustMarkStatus.ACTIVE,
        )
    )
    mark = result.scalars().first()

    return {
        "sub": sub,
        "id": trust_mark_id,
        "active": mark is not None,
    }
