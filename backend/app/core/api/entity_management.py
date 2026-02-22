"""Entity management API — CRUD + activate/suspend/revoke/rotate-keys."""

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus, SubordinateStatement
from app.core.models.signing_key import KeyAlgorithm
from app.core.schemas.entity import (
    EntityCreate,
    EntityListResponse,
    EntityResponse,
    EntityUpdate,
)
from app.database import get_session
from app.federation.jwt_builder import build_subordinate_statement
from app.keys.manager import generate_key, get_active_key, get_entity_jwks, rotate_key

router = APIRouter(prefix="/api/entities", tags=["Entity Management"])


def _entity_to_response(entity: Entity) -> EntityResponse:
    return EntityResponse(
        id=entity.id,
        entity_id=entity.entity_id,
        name=entity.name,
        organization=entity.organization,
        country=entity.country,
        entity_types=json.loads(entity.entity_types) if entity.entity_types else [],
        metadata=json.loads(entity.entity_metadata) if entity.entity_metadata else {},
        jwks=json.loads(entity.jwks) if entity.jwks else {},
        status=entity.status,
        authority_hints=json.loads(entity.authority_hints) if entity.authority_hints else [],
        contacts=json.loads(entity.contacts) if entity.contacts else [],
        statement_expires_seconds=entity.statement_expires_seconds,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


@router.post("/", response_model=EntityResponse, status_code=201)
async def create_entity(
    data: EntityCreate,
    session: AsyncSession = Depends(get_session),
) -> EntityResponse:
    """Register a new entity."""
    # Check uniqueness
    existing = await session.execute(
        select(Entity).where(Entity.entity_id == data.entity_id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Entity with this entity_id already exists")

    entity = Entity(
        entity_id=data.entity_id,
        name=data.name,
        organization=data.organization,
        country=data.country,
        entity_types=json.dumps(data.entity_types),
        entity_metadata=json.dumps(data.metadata) if data.metadata else "{}",
        authority_hints=json.dumps(data.authority_hints),
        contacts=json.dumps(data.contacts),
        statement_expires_seconds=data.statement_expires_seconds,
    )

    session.add(entity)
    await session.commit()
    await session.refresh(entity)

    # Generate signing key
    settings = get_settings()
    algo = KeyAlgorithm(settings.default_key_algorithm)
    key = await generate_key(session, entity.id, algo)

    # If external JWKS provided, use that; otherwise use generated key
    if data.jwks:
        entity.jwks = json.dumps(data.jwks)
    else:
        jwks = await get_entity_jwks(session, entity.id)
        entity.jwks = json.dumps(jwks)

    session.add(entity)
    await session.commit()
    await session.refresh(entity)

    return _entity_to_response(entity)


@router.get("/", response_model=EntityListResponse)
async def list_entities(
    status: EntityStatus | None = None,
    entity_type: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> EntityListResponse:
    """List all entities with optional filters."""
    query = select(Entity)
    count_query = select(func.count()).select_from(Entity)

    if status:
        query = query.where(Entity.status == status)
        count_query = count_query.where(Entity.status == status)

    # Count
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch
    query = query.offset(skip).limit(limit).order_by(Entity.created_at.desc())
    result = await session.execute(query)
    entities = result.scalars().all()

    # Filter by entity_type in Python (JSON field)
    if entity_type:
        filtered = []
        for e in entities:
            types = json.loads(e.entity_types) if e.entity_types else []
            if entity_type in types:
                filtered.append(e)
        entities = filtered
        total = len(filtered)

    return EntityListResponse(
        entities=[_entity_to_response(e) for e in entities],
        total=total,
    )


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(
    entity_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> EntityResponse:
    """Get entity by ID."""
    result = await session.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return _entity_to_response(entity)


@router.patch("/{entity_id}", response_model=EntityResponse)
async def update_entity(
    entity_id: uuid.UUID,
    data: EntityUpdate,
    session: AsyncSession = Depends(get_session),
) -> EntityResponse:
    """Update an entity's properties."""
    result = await session.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if data.name is not None:
        entity.name = data.name
    if data.organization is not None:
        entity.organization = data.organization
    if data.country is not None:
        entity.country = data.country
    if data.entity_types is not None:
        entity.entity_types = json.dumps(data.entity_types)
    if data.metadata is not None:
        entity.entity_metadata = json.dumps(data.metadata)
    if data.authority_hints is not None:
        entity.authority_hints = json.dumps(data.authority_hints)
    if data.contacts is not None:
        entity.contacts = json.dumps(data.contacts)
    if data.statement_expires_seconds is not None:
        entity.statement_expires_seconds = data.statement_expires_seconds

    entity.updated_at = datetime.utcnow()
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return _entity_to_response(entity)


@router.delete("/{entity_id}", status_code=204)
async def delete_entity(
    entity_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete an entity (only if in draft status)."""
    result = await session.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    if entity.status != EntityStatus.DRAFT:
        raise HTTPException(
            status_code=409,
            detail="Only draft entities can be deleted. Use revoke for active entities.",
        )
    await session.delete(entity)
    await session.commit()


@router.post("/{entity_id}/activate", response_model=EntityResponse)
async def activate_entity(
    entity_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> EntityResponse:
    """Activate a draft entity and generate its subordinate statement."""
    result = await session.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    if entity.status not in (EntityStatus.DRAFT, EntityStatus.SUSPENDED):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot activate entity in {entity.status} status",
        )

    entity.status = EntityStatus.ACTIVE
    entity.updated_at = datetime.utcnow()
    session.add(entity)
    await session.commit()
    await session.refresh(entity)

    # Generate subordinate statement from Trust Anchor
    await _generate_subordinate_statement(session, entity)

    return _entity_to_response(entity)


@router.post("/{entity_id}/suspend", response_model=EntityResponse)
async def suspend_entity(
    entity_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> EntityResponse:
    """Suspend an active entity."""
    result = await session.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    if entity.status != EntityStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Only active entities can be suspended")

    entity.status = EntityStatus.SUSPENDED
    entity.updated_at = datetime.utcnow()
    session.add(entity)

    # Invalidate current subordinate statements
    stmt_result = await session.execute(
        select(SubordinateStatement).where(
            SubordinateStatement.subject_id == entity_id,
            SubordinateStatement.is_current == True,  # noqa: E712
        )
    )
    for stmt in stmt_result.scalars().all():
        stmt.is_current = False
        session.add(stmt)

    await session.commit()
    await session.refresh(entity)
    return _entity_to_response(entity)


@router.post("/{entity_id}/revoke", response_model=EntityResponse)
async def revoke_entity(
    entity_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> EntityResponse:
    """Revoke an entity permanently."""
    result = await session.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    if entity.status == EntityStatus.REVOKED:
        raise HTTPException(status_code=409, detail="Entity is already revoked")

    entity.status = EntityStatus.REVOKED
    entity.updated_at = datetime.utcnow()
    session.add(entity)

    # Invalidate all subordinate statements
    stmt_result = await session.execute(
        select(SubordinateStatement).where(
            SubordinateStatement.subject_id == entity_id,
            SubordinateStatement.is_current == True,  # noqa: E712
        )
    )
    for stmt in stmt_result.scalars().all():
        stmt.is_current = False
        session.add(stmt)

    await session.commit()
    await session.refresh(entity)
    return _entity_to_response(entity)


@router.post("/{entity_id}/rotate-keys", response_model=EntityResponse)
async def rotate_entity_keys(
    entity_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> EntityResponse:
    """Rotate signing keys for an entity."""
    result = await session.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    settings = get_settings()
    algo = KeyAlgorithm(settings.default_key_algorithm)
    await rotate_key(session, entity.id, algo)

    # Update entity JWKS
    jwks = await get_entity_jwks(session, entity.id)
    entity.jwks = json.dumps(jwks)
    entity.updated_at = datetime.utcnow()
    session.add(entity)
    await session.commit()
    await session.refresh(entity)

    # Regenerate subordinate statement if active
    if entity.status == EntityStatus.ACTIVE:
        await _generate_subordinate_statement(session, entity)

    return _entity_to_response(entity)


async def _generate_subordinate_statement(
    session: AsyncSession, subject: Entity
) -> SubordinateStatement | None:
    """Generate a subordinate statement from the Trust Anchor for this entity."""
    settings = get_settings()

    # Get Trust Anchor entity
    ta_result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    ta = ta_result.scalars().first()
    if not ta:
        return None

    ta_key = await get_active_key(session, ta.id)
    if not ta_key:
        return None

    # Mark previous statements as not current
    prev_result = await session.execute(
        select(SubordinateStatement).where(
            SubordinateStatement.subject_id == subject.id,
            SubordinateStatement.issuer_id == ta.id,
            SubordinateStatement.is_current == True,  # noqa: E712
        )
    )
    for prev in prev_result.scalars().all():
        prev.is_current = False
        session.add(prev)

    expires_seconds = (
        subject.statement_expires_seconds or settings.default_statement_lifetime_seconds
    )

    subject_jwks = json.loads(subject.jwks) if subject.jwks else {}

    jwt_token = build_subordinate_statement(
        issuer_entity_id=settings.entity_id,
        subject_entity_id=subject.entity_id,
        signing_key=ta_key,
        subject_jwks=subject_jwks,
        expires_in=expires_seconds,
    )

    now = datetime.utcnow()
    from datetime import timedelta

    statement = SubordinateStatement(
        issuer_id=ta.id,
        subject_id=subject.id,
        issuer_entity_id=settings.entity_id,
        subject_entity_id=subject.entity_id,
        issued_at=now,
        expires_at=now + timedelta(seconds=expires_seconds),
        jwt=jwt_token,
        is_current=True,
    )
    session.add(statement)
    await session.commit()
    await session.refresh(statement)
    return statement
