"""GET /federation/resolve?sub=&anchor= — Resolve trust chain."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session
from app.exceptions import FederationError
from app.federation.constants import RESOLVE_RESPONSE_JWT
from app.federation.jwt_builder import build_resolve_response
from app.federation.trust_chain import resolve_trust_chain
from app.keys.manager import get_active_key
from app.core.models.entity import Entity
from sqlalchemy import select

router = APIRouter()


@router.get("/federation/resolve")
async def resolve(
    sub: str = Query(..., description="Subject entity_id to resolve"),
    anchor: str | None = Query(None, description="Trust anchor entity_id"),
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Resolve a trust chain and return a signed resolve response JWT."""
    settings = get_settings()
    anchor_entity_id = anchor or settings.entity_id

    try:
        chain_result = await resolve_trust_chain(
            session=session,
            subject_entity_id=sub,
            trust_anchor_entity_id=anchor_entity_id,
        )
    except FederationError as exc:
        return Response(
            content=f'{{"error": "{exc.message}"}}',
            status_code=exc.status_code,
            media_type="application/json",
        )

    # Get TA signing key for the resolve response
    result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    ta = result.scalars().first()
    if not ta:
        return Response(
            content='{"error": "Trust Anchor not configured"}',
            status_code=500,
            media_type="application/json",
        )

    signing_key = await get_active_key(session, ta.id)
    if not signing_key:
        return Response(
            content='{"error": "No active signing key"}',
            status_code=500,
            media_type="application/json",
        )

    token = build_resolve_response(
        issuer_entity_id=settings.entity_id,
        subject_entity_id=sub,
        signing_key=signing_key,
        metadata=chain_result["metadata"],
        trust_chain=chain_result["trust_chain"],
    )

    return Response(content=token, media_type=RESOLVE_RESPONSE_JWT)
