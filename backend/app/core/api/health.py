"""Health and dashboard statistics API."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models.entity import Entity, EntityStatus, SubordinateStatement
from app.core.models.signing_key import KeyStatus, SigningKey
from app.core.models.trust_mark import TrustMark, TrustMarkDefinition, TrustMarkStatus
from app.database import get_session

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("/stats")
async def dashboard_stats(
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Dashboard statistics."""
    now = datetime.utcnow()
    warning_threshold = now + timedelta(days=3)

    # Entity counts by status
    entity_counts = {}
    for status in EntityStatus:
        result = await session.execute(
            select(func.count()).select_from(Entity).where(Entity.status == status)
        )
        entity_counts[status.value] = result.scalar() or 0

    total_entities = sum(entity_counts.values())

    # Statement stats
    stmt_result = await session.execute(
        select(func.count())
        .select_from(SubordinateStatement)
        .where(SubordinateStatement.is_current == True)  # noqa: E712
    )
    current_statements = stmt_result.scalar() or 0

    expiring_stmts_result = await session.execute(
        select(func.count())
        .select_from(SubordinateStatement)
        .where(
            SubordinateStatement.is_current == True,  # noqa: E712
            SubordinateStatement.expires_at <= warning_threshold,
            SubordinateStatement.expires_at > now,
        )
    )
    expiring_statements = expiring_stmts_result.scalar() or 0

    expired_stmts_result = await session.execute(
        select(func.count())
        .select_from(SubordinateStatement)
        .where(
            SubordinateStatement.is_current == True,  # noqa: E712
            SubordinateStatement.expires_at <= now,
        )
    )
    expired_statements = expired_stmts_result.scalar() or 0

    # Key stats
    active_keys_result = await session.execute(
        select(func.count())
        .select_from(SigningKey)
        .where(SigningKey.status == KeyStatus.ACTIVE)
    )
    active_keys = active_keys_result.scalar() or 0

    # Trust mark stats
    tm_result = await session.execute(
        select(func.count())
        .select_from(TrustMark)
        .where(TrustMark.status == TrustMarkStatus.ACTIVE)
    )
    active_trust_marks = tm_result.scalar() or 0

    def_result = await session.execute(
        select(func.count()).select_from(TrustMarkDefinition)
    )
    trust_mark_definitions = def_result.scalar() or 0

    return {
        "entities": {
            "total": total_entities,
            "by_status": entity_counts,
        },
        "statements": {
            "current": current_statements,
            "expiring_soon": expiring_statements,
            "expired": expired_statements,
        },
        "keys": {
            "active": active_keys,
        },
        "trust_marks": {
            "active": active_trust_marks,
            "definitions": trust_mark_definitions,
        },
    }


@router.get("/expiring")
async def expiring_items(
    days: int = 3,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """List items expiring within N days."""
    now = datetime.utcnow()
    threshold = now + timedelta(days=days)

    # Expiring statements
    stmt_result = await session.execute(
        select(SubordinateStatement).where(
            SubordinateStatement.is_current == True,  # noqa: E712
            SubordinateStatement.expires_at <= threshold,
            SubordinateStatement.expires_at > now,
        )
    )
    expiring_statements = [
        {
            "id": str(s.id),
            "subject": s.subject_entity_id,
            "expires_at": s.expires_at.isoformat(),
        }
        for s in stmt_result.scalars().all()
    ]

    # Expiring trust marks
    tm_result = await session.execute(
        select(TrustMark).where(
            TrustMark.status == TrustMarkStatus.ACTIVE,
            TrustMark.expires_at != None,  # noqa: E711
            TrustMark.expires_at <= threshold,
            TrustMark.expires_at > now,
        )
    )
    expiring_marks = [
        {
            "id": str(m.id),
            "subject": m.subject_entity_id,
            "trust_mark_id": m.trust_mark_id,
            "expires_at": m.expires_at.isoformat() if m.expires_at else None,
        }
        for m in tm_result.scalars().all()
    ]

    return {
        "statements": expiring_statements,
        "trust_marks": expiring_marks,
    }
