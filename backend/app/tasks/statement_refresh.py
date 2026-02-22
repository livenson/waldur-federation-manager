"""Background task: regenerate statements approaching expiry."""

import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus, SubordinateStatement
from app.database import async_session
from app.federation.jwt_builder import build_subordinate_statement
from app.keys.manager import get_active_key

logger = logging.getLogger(__name__)


async def refresh_expiring_statements() -> None:
    """Find and regenerate statements that will expire within the warning period."""
    settings = get_settings()
    threshold = datetime.utcnow() + timedelta(days=settings.expiry_warning_days)

    async with async_session() as session:
        # Find expiring current statements
        result = await session.execute(
            select(SubordinateStatement).where(
                SubordinateStatement.is_current == True,  # noqa: E712
                SubordinateStatement.expires_at <= threshold,
            )
        )
        expiring = result.scalars().all()

        if not expiring:
            logger.info("No statements need refresh")
            return

        # Get Trust Anchor
        ta_result = await session.execute(
            select(Entity).where(Entity.entity_id == settings.entity_id)
        )
        ta = ta_result.scalars().first()
        if not ta:
            logger.error("Trust Anchor not configured")
            return

        ta_key = await get_active_key(session, ta.id)
        if not ta_key:
            logger.error("No active signing key for Trust Anchor")
            return

        refreshed = 0
        for stmt in expiring:
            try:
                # Get subject entity
                sub_result = await session.execute(
                    select(Entity).where(Entity.id == stmt.subject_id)
                )
                subject = sub_result.scalars().first()
                if not subject or subject.status != EntityStatus.ACTIVE:
                    continue

                # Mark old as not current
                stmt.is_current = False
                session.add(stmt)

                expires_seconds = (
                    subject.statement_expires_seconds
                    or settings.default_statement_lifetime_seconds
                )

                subject_jwks = json.loads(subject.jwks) if subject.jwks else {}

                jwt_token = build_subordinate_statement(
                    issuer_entity_id=settings.entity_id,
                    subject_entity_id=stmt.subject_entity_id,
                    signing_key=ta_key,
                    subject_jwks=subject_jwks,
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
                    expires_in=expires_seconds,
                )

                now = datetime.utcnow()
                new_stmt = SubordinateStatement(
                    issuer_id=ta.id,
                    subject_id=subject.id,
                    issuer_entity_id=settings.entity_id,
                    subject_entity_id=stmt.subject_entity_id,
                    metadata_override=stmt.metadata_override,
                    metadata_policy=stmt.metadata_policy,
                    constraints=stmt.constraints,
                    trust_marks=stmt.trust_marks,
                    issued_at=now,
                    expires_at=now + timedelta(seconds=expires_seconds),
                    jwt=jwt_token,
                    is_current=True,
                )
                session.add(new_stmt)
                refreshed += 1
            except Exception:
                logger.exception(
                    "Failed to refresh statement for %s", stmt.subject_entity_id
                )

        await session.commit()
        logger.info("Refreshed %d statements", refreshed)
