"""Subordinate statement management API."""

import json
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus, SubordinateStatement
from app.core.schemas.statement import (
    StatementCreate,
    StatementListResponse,
    StatementResponse,
    StatementUpdate,
)
from app.database import get_session
from app.federation.jwt_builder import build_subordinate_statement
from app.keys.manager import get_active_key, get_entity_jwks

router = APIRouter(prefix="/api/statements", tags=["Statement Management"])


def _statement_to_response(stmt: SubordinateStatement) -> StatementResponse:
    return StatementResponse(
        id=stmt.id,
        issuer_entity_id=stmt.issuer_entity_id,
        subject_entity_id=stmt.subject_entity_id,
        metadata_override=json.loads(stmt.metadata_override) if stmt.metadata_override else {},
        metadata_policy=json.loads(stmt.metadata_policy) if stmt.metadata_policy else {},
        constraints=json.loads(stmt.constraints) if stmt.constraints else {},
        trust_marks=json.loads(stmt.trust_marks) if stmt.trust_marks else [],
        issued_at=stmt.issued_at,
        expires_at=stmt.expires_at,
        jwt=stmt.jwt,
        is_current=stmt.is_current,
    )


@router.post("/", response_model=StatementResponse, status_code=201)
async def create_statement(
    data: StatementCreate,
    session: AsyncSession = Depends(get_session),
) -> StatementResponse:
    """Create (or regenerate) a subordinate statement for a subject entity."""
    settings = get_settings()

    # Get Trust Anchor
    ta_result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    ta = ta_result.scalars().first()
    if not ta:
        raise HTTPException(status_code=500, detail="Trust Anchor not configured")

    # Get subject entity
    sub_result = await session.execute(
        select(Entity).where(Entity.entity_id == data.subject_entity_id)
    )
    subject = sub_result.scalars().first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject entity not found")
    if subject.status != EntityStatus.ACTIVE:
        raise HTTPException(status_code=409, detail="Subject entity is not active")

    ta_key = await get_active_key(session, ta.id)
    if not ta_key:
        raise HTTPException(status_code=500, detail="No active signing key for Trust Anchor")

    # Mark previous statements as not current
    prev_result = await session.execute(
        select(SubordinateStatement).where(
            SubordinateStatement.subject_entity_id == data.subject_entity_id,
            SubordinateStatement.issuer_entity_id == settings.entity_id,
            SubordinateStatement.is_current == True,  # noqa: E712
        )
    )
    for prev in prev_result.scalars().all():
        prev.is_current = False
        session.add(prev)

    expires_seconds = (
        data.expires_in_seconds
        or subject.statement_expires_seconds
        or settings.default_statement_lifetime_seconds
    )

    subject_jwks = json.loads(subject.jwks) if subject.jwks else {}

    jwt_token = build_subordinate_statement(
        issuer_entity_id=settings.entity_id,
        subject_entity_id=data.subject_entity_id,
        signing_key=ta_key,
        subject_jwks=subject_jwks,
        metadata_override=data.metadata_override,
        metadata_policy=data.metadata_policy,
        constraints=data.constraints,
        trust_marks=data.trust_marks,
        expires_in=expires_seconds,
    )

    now = datetime.utcnow()
    statement = SubordinateStatement(
        issuer_id=ta.id,
        subject_id=subject.id,
        issuer_entity_id=settings.entity_id,
        subject_entity_id=data.subject_entity_id,
        metadata_override=json.dumps(data.metadata_override) if data.metadata_override else "{}",
        metadata_policy=json.dumps(data.metadata_policy) if data.metadata_policy else "{}",
        constraints=json.dumps(data.constraints) if data.constraints else "{}",
        trust_marks=json.dumps(data.trust_marks) if data.trust_marks else "[]",
        issued_at=now,
        expires_at=now + timedelta(seconds=expires_seconds),
        jwt=jwt_token,
        is_current=True,
    )
    session.add(statement)
    await session.commit()
    await session.refresh(statement)
    return _statement_to_response(statement)


@router.get("/", response_model=StatementListResponse)
async def list_statements(
    subject_entity_id: str | None = None,
    current_only: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> StatementListResponse:
    """List subordinate statements."""
    query = select(SubordinateStatement)
    count_query = select(func.count()).select_from(SubordinateStatement)

    if subject_entity_id:
        query = query.where(SubordinateStatement.subject_entity_id == subject_entity_id)
        count_query = count_query.where(
            SubordinateStatement.subject_entity_id == subject_entity_id
        )
    if current_only:
        query = query.where(SubordinateStatement.is_current == True)  # noqa: E712
        count_query = count_query.where(SubordinateStatement.is_current == True)  # noqa: E712

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(skip).limit(limit).order_by(SubordinateStatement.issued_at.desc())
    result = await session.execute(query)
    statements = result.scalars().all()

    return StatementListResponse(
        statements=[_statement_to_response(s) for s in statements],
        total=total,
    )


@router.get("/{statement_id}", response_model=StatementResponse)
async def get_statement(
    statement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> StatementResponse:
    """Get a specific statement by ID."""
    result = await session.execute(
        select(SubordinateStatement).where(SubordinateStatement.id == statement_id)
    )
    stmt = result.scalars().first()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return _statement_to_response(stmt)


@router.post("/{statement_id}/regenerate", response_model=StatementResponse)
async def regenerate_statement(
    statement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> StatementResponse:
    """Regenerate an existing statement with fresh timestamps and signature."""
    result = await session.execute(
        select(SubordinateStatement).where(SubordinateStatement.id == statement_id)
    )
    old_stmt = result.scalars().first()
    if not old_stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    data = StatementCreate(
        subject_entity_id=old_stmt.subject_entity_id,
        metadata_override=(
            json.loads(old_stmt.metadata_override) if old_stmt.metadata_override else None
        ),
        metadata_policy=(
            json.loads(old_stmt.metadata_policy) if old_stmt.metadata_policy else None
        ),
        constraints=json.loads(old_stmt.constraints) if old_stmt.constraints else None,
        trust_marks=json.loads(old_stmt.trust_marks) if old_stmt.trust_marks else None,
    )
    return await create_statement(data, session)


@router.post("/bulk-regenerate")
async def bulk_regenerate_statements(
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Regenerate all current statements."""
    result = await session.execute(
        select(SubordinateStatement).where(
            SubordinateStatement.is_current == True  # noqa: E712
        )
    )
    statements = result.scalars().all()
    regenerated = 0
    errors = 0

    for stmt in statements:
        try:
            data = StatementCreate(
                subject_entity_id=stmt.subject_entity_id,
                metadata_override=(
                    json.loads(stmt.metadata_override)
                    if stmt.metadata_override and stmt.metadata_override != "{}"
                    else None
                ),
                metadata_policy=(
                    json.loads(stmt.metadata_policy)
                    if stmt.metadata_policy and stmt.metadata_policy != "{}"
                    else None
                ),
                constraints=(
                    json.loads(stmt.constraints)
                    if stmt.constraints and stmt.constraints != "{}"
                    else None
                ),
                trust_marks=(
                    json.loads(stmt.trust_marks)
                    if stmt.trust_marks and stmt.trust_marks != "[]"
                    else None
                ),
            )
            await create_statement(data, session)
            regenerated += 1
        except Exception:
            errors += 1

    return {"regenerated": regenerated, "errors": errors}
