"""GET /federation/fetch?sub= — Fetch subordinate statement."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models.entity import SubordinateStatement
from app.database import get_session
from app.federation.constants import ENTITY_STATEMENT_JWT

router = APIRouter()


@router.get("/federation/fetch")
async def fetch_subordinate_statement(
    sub: str = Query(..., description="Subject entity_id"),
    iss: str | None = Query(None, description="Issuer entity_id (optional filter)"),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Fetch the current subordinate statement about a subject entity."""
    query = select(SubordinateStatement).where(
        SubordinateStatement.subject_entity_id == sub,
        SubordinateStatement.is_current == True,  # noqa: E712
    )
    if iss:
        query = query.where(SubordinateStatement.issuer_entity_id == iss)

    result = await session.execute(query)
    statement = result.scalars().first()

    if not statement:
        return Response(
            content='{"error": "No statement found for subject"}',
            status_code=404,
            media_type="application/json",
        )

    return Response(content=statement.jwt, media_type=ENTITY_STATEMENT_JWT)
