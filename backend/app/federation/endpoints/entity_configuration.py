"""GET /.well-known/openid-federation — Trust Anchor entity configuration."""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus
from app.database import get_session
from app.federation.constants import ENTITY_STATEMENT_JWT
from app.federation.jwt_builder import build_entity_configuration
from app.keys.manager import get_active_key, get_entity_jwks

router = APIRouter()


@router.get("/.well-known/openid-federation")
async def entity_configuration(session: AsyncSession = Depends(get_session)) -> Response:
    """Return the Trust Anchor's self-signed entity configuration JWT."""
    settings = get_settings()

    # Find the Trust Anchor entity (entity_id matches settings.entity_id)
    result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    anchor = result.scalars().first()
    if not anchor:
        return Response(
            content='{"error": "Trust Anchor not configured"}',
            status_code=404,
            media_type="application/json",
        )

    signing_key = await get_active_key(session, anchor.id)
    if not signing_key:
        return Response(
            content='{"error": "No active signing key"}',
            status_code=500,
            media_type="application/json",
        )

    jwks = await get_entity_jwks(session, anchor.id)
    metadata = json.loads(anchor.entity_metadata) if anchor.entity_metadata else {}
    authority_hints = json.loads(anchor.authority_hints) if anchor.authority_hints else []
    contacts = json.loads(anchor.contacts) if anchor.contacts else []

    # Add federation_entity metadata with federation endpoints
    if "federation_entity" not in metadata:
        metadata["federation_entity"] = {}
    fe_meta = metadata["federation_entity"]
    base_url = settings.entity_id.rstrip("/")
    fe_meta.setdefault("federation_fetch_endpoint", f"{base_url}/federation/fetch")
    fe_meta.setdefault("federation_list_endpoint", f"{base_url}/federation/list")
    fe_meta.setdefault("federation_resolve_endpoint", f"{base_url}/federation/resolve")
    fe_meta.setdefault(
        "federation_trust_mark_status_endpoint",
        f"{base_url}/federation/trust_mark_status",
    )
    fe_meta.setdefault(
        "federation_trust_mark_list_endpoint",
        f"{base_url}/federation/trust_mark_list",
    )
    fe_meta.setdefault(
        "federation_historical_keys_endpoint",
        f"{base_url}/federation/historical_keys",
    )

    token = build_entity_configuration(
        entity_id=settings.entity_id,
        signing_key=signing_key,
        jwks=jwks,
        authority_hints=authority_hints if authority_hints else None,
        metadata=metadata if metadata else None,
        contacts=contacts if contacts else None,
        expires_in=(
            anchor.statement_expires_seconds
            or settings.default_statement_lifetime_seconds
        ),
    )

    return Response(content=token, media_type=ENTITY_STATEMENT_JWT)
