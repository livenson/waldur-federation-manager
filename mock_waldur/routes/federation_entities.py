"""Federation entity mapping CRUD — maps entity_id to local ISD source names."""

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mock_waldur.config import get_settings
from mock_waldur.database import get_session
from mock_waldur.federation_auth import _refresh_jwks
from mock_waldur.models import FederationEntity
from mock_waldur.policy_engine import refresh_metadata_policy

router = APIRouter(prefix="/api/federation-entities", tags=["Federation Entities"])


class FederationEntityCreate(BaseModel):
    entity_id: str
    isd_source: str
    trust_anchor_url: str | None = None


class FederationEntityResponse(BaseModel):
    id: str
    entity_id: str
    isd_source: str
    trust_anchor_url: str
    jwks_updated_at: datetime | None
    policy_updated_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


def _to_response(entity: FederationEntity) -> FederationEntityResponse:
    return FederationEntityResponse(
        id=str(entity.id),
        entity_id=entity.entity_id,
        isd_source=entity.isd_source,
        trust_anchor_url=entity.trust_anchor_url,
        jwks_updated_at=entity.jwks_updated_at,
        policy_updated_at=entity.policy_updated_at,
        is_active=entity.is_active,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


@router.post("/", response_model=FederationEntityResponse, status_code=201)
async def create_federation_entity(
    data: FederationEntityCreate,
    session: AsyncSession = Depends(get_session),
) -> FederationEntityResponse:
    """Register a federation entity mapping."""
    settings = get_settings()

    # Check uniqueness
    existing = await session.execute(
        select(FederationEntity).where(FederationEntity.entity_id == data.entity_id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Entity mapping already exists for this entity_id")

    existing_source = await session.execute(
        select(FederationEntity).where(FederationEntity.isd_source == data.isd_source)
    )
    if existing_source.scalars().first():
        raise HTTPException(status_code=409, detail="ISD source name already in use")

    entity = FederationEntity(
        entity_id=data.entity_id,
        isd_source=data.isd_source,
        trust_anchor_url=data.trust_anchor_url or settings.default_trust_anchor_url,
    )
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return _to_response(entity)


@router.get("/", response_model=list[FederationEntityResponse])
async def list_federation_entities(
    session: AsyncSession = Depends(get_session),
) -> list[FederationEntityResponse]:
    """List all federation entity mappings."""
    result = await session.execute(
        select(FederationEntity).order_by(FederationEntity.created_at.desc())
    )
    entities = result.scalars().all()
    return [_to_response(e) for e in entities]


@router.get("/{entity_uuid}", response_model=FederationEntityResponse)
async def get_federation_entity(
    entity_uuid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> FederationEntityResponse:
    """Get a single federation entity mapping."""
    result = await session.execute(
        select(FederationEntity).where(FederationEntity.id == entity_uuid)
    )
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Federation entity mapping not found")
    return _to_response(entity)


@router.delete("/{entity_uuid}", status_code=204)
async def delete_federation_entity(
    entity_uuid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a federation entity mapping."""
    result = await session.execute(
        select(FederationEntity).where(FederationEntity.id == entity_uuid)
    )
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Federation entity mapping not found")
    await session.delete(entity)
    await session.commit()


@router.post("/{entity_uuid}/refresh", response_model=FederationEntityResponse)
async def refresh_federation_entity(
    entity_uuid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> FederationEntityResponse:
    """Force refresh JWKS and metadata policy from the Trust Anchor."""
    result = await session.execute(
        select(FederationEntity).where(FederationEntity.id == entity_uuid)
    )
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Federation entity mapping not found")

    # Refresh JWKS
    try:
        jwks = await _refresh_jwks(entity)
        entity.jwks = json.dumps(jwks)
        entity.jwks_updated_at = datetime.utcnow()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to refresh JWKS: {exc}")

    # Refresh policy
    await refresh_metadata_policy(entity, session)

    entity.updated_at = datetime.utcnow()
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return _to_response(entity)
