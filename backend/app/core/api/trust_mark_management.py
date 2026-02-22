"""Trust mark management API — definitions CRUD + issue/revoke trust marks."""

import json
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus
from app.core.models.trust_mark import TrustMark, TrustMarkDefinition, TrustMarkStatus
from app.core.schemas.trust_mark import (
    TrustMarkDefinitionCreate,
    TrustMarkDefinitionListResponse,
    TrustMarkDefinitionResponse,
    TrustMarkDefinitionUpdate,
    TrustMarkIssue,
    TrustMarkListResponse,
    TrustMarkResponse,
    TrustMarkRevoke,
)
from app.database import get_session
from app.federation.jwt_builder import build_trust_mark_jwt
from app.keys.manager import get_active_key

router = APIRouter(prefix="/api/trust-marks", tags=["Trust Mark Management"])


def _def_to_response(d: TrustMarkDefinition) -> TrustMarkDefinitionResponse:
    return TrustMarkDefinitionResponse(
        id=d.id,
        trust_mark_id=d.trust_mark_id,
        name=d.name,
        description=d.description,
        ref=d.ref,
        logo_uri=d.logo_uri,
        allowed_issuer_ids=(
            json.loads(d.allowed_issuer_ids) if d.allowed_issuer_ids else []
        ),
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


def _mark_to_response(m: TrustMark) -> TrustMarkResponse:
    return TrustMarkResponse(
        id=m.id,
        trust_mark_id=m.trust_mark_id,
        subject_entity_id=m.subject_entity_id,
        issued_at=m.issued_at,
        expires_at=m.expires_at,
        jwt=m.jwt,
        status=m.status,
        revoked_at=m.revoked_at,
        revocation_reason=m.revocation_reason,
    )


# --- Definitions ---


@router.post("/definitions", response_model=TrustMarkDefinitionResponse, status_code=201)
async def create_definition(
    data: TrustMarkDefinitionCreate,
    session: AsyncSession = Depends(get_session),
) -> TrustMarkDefinitionResponse:
    """Create a trust mark definition."""
    existing = await session.execute(
        select(TrustMarkDefinition).where(
            TrustMarkDefinition.trust_mark_id == data.trust_mark_id
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Trust mark ID already exists")

    defn = TrustMarkDefinition(
        trust_mark_id=data.trust_mark_id,
        name=data.name,
        description=data.description,
        ref=data.ref,
        logo_uri=data.logo_uri,
        allowed_issuer_ids=json.dumps(data.allowed_issuer_ids),
    )
    session.add(defn)
    await session.commit()
    await session.refresh(defn)
    return _def_to_response(defn)


@router.get("/definitions", response_model=TrustMarkDefinitionListResponse)
async def list_definitions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> TrustMarkDefinitionListResponse:
    """List trust mark definitions."""
    total_result = await session.execute(
        select(func.count()).select_from(TrustMarkDefinition)
    )
    total = total_result.scalar() or 0

    result = await session.execute(
        select(TrustMarkDefinition)
        .offset(skip)
        .limit(limit)
        .order_by(TrustMarkDefinition.created_at.desc())
    )
    definitions = result.scalars().all()
    return TrustMarkDefinitionListResponse(
        definitions=[_def_to_response(d) for d in definitions],
        total=total,
    )


@router.get("/definitions/{definition_id}", response_model=TrustMarkDefinitionResponse)
async def get_definition(
    definition_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> TrustMarkDefinitionResponse:
    """Get a trust mark definition."""
    result = await session.execute(
        select(TrustMarkDefinition).where(TrustMarkDefinition.id == definition_id)
    )
    defn = result.scalars().first()
    if not defn:
        raise HTTPException(status_code=404, detail="Definition not found")
    return _def_to_response(defn)


@router.patch("/definitions/{definition_id}", response_model=TrustMarkDefinitionResponse)
async def update_definition(
    definition_id: uuid.UUID,
    data: TrustMarkDefinitionUpdate,
    session: AsyncSession = Depends(get_session),
) -> TrustMarkDefinitionResponse:
    """Update a trust mark definition."""
    result = await session.execute(
        select(TrustMarkDefinition).where(TrustMarkDefinition.id == definition_id)
    )
    defn = result.scalars().first()
    if not defn:
        raise HTTPException(status_code=404, detail="Definition not found")

    if data.name is not None:
        defn.name = data.name
    if data.description is not None:
        defn.description = data.description
    if data.ref is not None:
        defn.ref = data.ref
    if data.logo_uri is not None:
        defn.logo_uri = data.logo_uri
    if data.allowed_issuer_ids is not None:
        defn.allowed_issuer_ids = json.dumps(data.allowed_issuer_ids)

    defn.updated_at = datetime.utcnow()
    session.add(defn)
    await session.commit()
    await session.refresh(defn)
    return _def_to_response(defn)


@router.delete("/definitions/{definition_id}", status_code=204)
async def delete_definition(
    definition_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a trust mark definition."""
    result = await session.execute(
        select(TrustMarkDefinition).where(TrustMarkDefinition.id == definition_id)
    )
    defn = result.scalars().first()
    if not defn:
        raise HTTPException(status_code=404, detail="Definition not found")
    await session.delete(defn)
    await session.commit()


# --- Trust Marks ---


@router.post("/issue", response_model=TrustMarkResponse, status_code=201)
async def issue_trust_mark(
    data: TrustMarkIssue,
    session: AsyncSession = Depends(get_session),
) -> TrustMarkResponse:
    """Issue a trust mark to a subject entity."""
    settings = get_settings()

    # Get definition
    def_result = await session.execute(
        select(TrustMarkDefinition).where(
            TrustMarkDefinition.trust_mark_id == data.trust_mark_id
        )
    )
    defn = def_result.scalars().first()
    if not defn:
        raise HTTPException(status_code=404, detail="Trust mark definition not found")

    # Get subject entity
    sub_result = await session.execute(
        select(Entity).where(Entity.entity_id == data.subject_entity_id)
    )
    subject = sub_result.scalars().first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject entity not found")
    if subject.status != EntityStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Subject entity is not active")

    # Get Trust Anchor as issuer
    ta_result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    ta = ta_result.scalars().first()
    if not ta:
        raise HTTPException(status_code=500, detail="Trust Anchor not configured")

    signing_key = await get_active_key(session, ta.id)
    if not signing_key:
        raise HTTPException(status_code=500, detail="No active signing key")

    now = datetime.utcnow()
    expires_at = None
    if data.expires_in_seconds:
        expires_at = now + timedelta(seconds=data.expires_in_seconds)

    jwt_token = build_trust_mark_jwt(
        issuer_entity_id=settings.entity_id,
        subject_entity_id=data.subject_entity_id,
        trust_mark_id=data.trust_mark_id,
        signing_key=signing_key,
        ref=defn.ref,
        logo_uri=defn.logo_uri,
        expires_in=data.expires_in_seconds,
    )

    mark = TrustMark(
        definition_id=defn.id,
        subject_id=subject.id,
        issuer_id=ta.id,
        subject_entity_id=data.subject_entity_id,
        trust_mark_id=data.trust_mark_id,
        issued_at=now,
        expires_at=expires_at,
        jwt=jwt_token,
    )
    session.add(mark)
    await session.commit()
    await session.refresh(mark)
    return _mark_to_response(mark)


@router.get("/", response_model=TrustMarkListResponse)
async def list_trust_marks(
    subject_entity_id: str | None = None,
    trust_mark_id: str | None = None,
    status: TrustMarkStatus | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> TrustMarkListResponse:
    """List trust marks with optional filters."""
    query = select(TrustMark)
    count_query = select(func.count()).select_from(TrustMark)

    if subject_entity_id:
        query = query.where(TrustMark.subject_entity_id == subject_entity_id)
        count_query = count_query.where(TrustMark.subject_entity_id == subject_entity_id)
    if trust_mark_id:
        query = query.where(TrustMark.trust_mark_id == trust_mark_id)
        count_query = count_query.where(TrustMark.trust_mark_id == trust_mark_id)
    if status:
        query = query.where(TrustMark.status == status)
        count_query = count_query.where(TrustMark.status == status)

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(skip).limit(limit).order_by(TrustMark.issued_at.desc())
    result = await session.execute(query)
    marks = result.scalars().all()

    return TrustMarkListResponse(
        trust_marks=[_mark_to_response(m) for m in marks],
        total=total,
    )


@router.post("/{mark_id}/revoke", response_model=TrustMarkResponse)
async def revoke_trust_mark(
    mark_id: uuid.UUID,
    data: TrustMarkRevoke | None = None,
    session: AsyncSession = Depends(get_session),
) -> TrustMarkResponse:
    """Revoke a trust mark."""
    result = await session.execute(
        select(TrustMark).where(TrustMark.id == mark_id)
    )
    mark = result.scalars().first()
    if not mark:
        raise HTTPException(status_code=404, detail="Trust mark not found")
    if mark.status == TrustMarkStatus.REVOKED:
        raise HTTPException(status_code=409, detail="Trust mark already revoked")

    mark.status = TrustMarkStatus.REVOKED
    mark.revoked_at = datetime.utcnow()
    if data and data.reason:
        mark.revocation_reason = data.reason

    session.add(mark)
    await session.commit()
    await session.refresh(mark)
    return _mark_to_response(mark)
