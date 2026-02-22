"""GET /federation/trust_mark_list — List trust marks."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models.trust_mark import TrustMark, TrustMarkStatus
from app.database import get_session

router = APIRouter()


@router.get("/federation/trust_mark_list")
async def trust_mark_list(
    sub: str | None = Query(None, description="Filter by subject entity_id"),
    trust_mark_id: str | None = Query(None, description="Filter by trust mark id"),
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    """List active trust mark JWTs, optionally filtered by subject or trust mark id."""
    query = select(TrustMark).where(TrustMark.status == TrustMarkStatus.ACTIVE)

    if sub:
        query = query.where(TrustMark.subject_entity_id == sub)
    if trust_mark_id:
        query = query.where(TrustMark.trust_mark_id == trust_mark_id)

    result = await session.execute(query)
    marks = result.scalars().all()

    return [m.jwt for m in marks]
