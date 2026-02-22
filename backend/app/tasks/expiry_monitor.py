"""Background task: log warnings for expiring statements/marks/keys."""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from app.config import get_settings
from app.core.models.entity import SubordinateStatement
from app.core.models.trust_mark import TrustMark, TrustMarkStatus
from app.database import async_session

logger = logging.getLogger(__name__)


async def check_expiring_items() -> None:
    """Check for items approaching expiry and log warnings."""
    settings = get_settings()
    now = datetime.utcnow()
    threshold = now + timedelta(days=settings.expiry_warning_days)

    async with async_session() as session:
        # Expiring statements
        stmt_result = await session.execute(
            select(SubordinateStatement).where(
                SubordinateStatement.is_current == True,  # noqa: E712
                SubordinateStatement.expires_at <= threshold,
                SubordinateStatement.expires_at > now,
            )
        )
        expiring_stmts = stmt_result.scalars().all()
        for stmt in expiring_stmts:
            logger.warning(
                "Statement for %s expires at %s",
                stmt.subject_entity_id,
                stmt.expires_at.isoformat(),
            )

        # Expired statements still marked current
        expired_result = await session.execute(
            select(SubordinateStatement).where(
                SubordinateStatement.is_current == True,  # noqa: E712
                SubordinateStatement.expires_at <= now,
            )
        )
        expired_stmts = expired_result.scalars().all()
        for stmt in expired_stmts:
            logger.error(
                "Statement for %s has EXPIRED at %s",
                stmt.subject_entity_id,
                stmt.expires_at.isoformat(),
            )

        # Expiring trust marks
        tm_result = await session.execute(
            select(TrustMark).where(
                TrustMark.status == TrustMarkStatus.ACTIVE,
                TrustMark.expires_at != None,  # noqa: E711
                TrustMark.expires_at <= threshold,
                TrustMark.expires_at > now,
            )
        )
        expiring_marks = tm_result.scalars().all()
        for mark in expiring_marks:
            logger.warning(
                "Trust mark %s for %s expires at %s",
                mark.trust_mark_id,
                mark.subject_entity_id,
                mark.expires_at.isoformat() if mark.expires_at else "N/A",
            )

        total_warnings = len(expiring_stmts) + len(expired_stmts) + len(expiring_marks)
        if total_warnings:
            logger.info("Expiry monitor found %d items needing attention", total_warnings)
        else:
            logger.info("Expiry monitor: all items healthy")
