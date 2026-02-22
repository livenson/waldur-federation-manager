"""Push notification delivery to registered Waldur instances."""

import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity
from app.core.models.waldur_instance import WaldurInstance
from app.federation.jwt_builder import build_notification_jwt
from app.keys.manager import get_active_key

logger = logging.getLogger(__name__)


async def notify_instances(
    session: AsyncSession, event_type: str, payload: dict
) -> None:
    """Build a notification JWT and deliver it to all registered Waldur instances.

    All DB reads happen before the background task is created so that the
    session is never accessed from the detached coroutine.
    """
    settings = get_settings()

    # Get all registered instances
    result = await session.execute(select(WaldurInstance))
    instances = list(result.scalars().all())
    if not instances:
        return

    # Get Trust Anchor entity + active signing key
    ta_result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    ta = ta_result.scalars().first()
    if not ta:
        logger.warning("Trust Anchor entity not found, skipping notification")
        return

    ta_key = await get_active_key(session, ta.id)
    if not ta_key:
        logger.warning("No active signing key for Trust Anchor, skipping notification")
        return

    # Build JWT (before detaching)
    token = build_notification_jwt(
        issuer_entity_id=settings.entity_id,
        signing_key=ta_key,
        event=event_type,
        payload_fields=payload,
    )

    # Collect callback URLs
    callback_urls = [
        f"{inst.base_url.rstrip('/')}/api/federation-notifications/"
        for inst in instances
    ]

    # Detach delivery into a background task
    asyncio.create_task(_deliver(token, callback_urls, event_type))


async def _deliver(token: str, urls: list[str], event_type: str) -> None:
    """POST the notification JWT to each URL concurrently (best-effort)."""

    async def _post(client: httpx.AsyncClient, url: str) -> None:
        try:
            resp = await client.post(
                url,
                json={"event": event_type},
                headers={"Authorization": f"Bearer {token}"},
            )
            logger.info(
                "Notification %s delivered to %s (status %d)",
                event_type,
                url,
                resp.status_code,
            )
        except Exception as exc:
            logger.warning(
                "Failed to deliver notification %s to %s: %s",
                event_type,
                url,
                exc,
            )

    async with httpx.AsyncClient(timeout=5.0) as client:
        await asyncio.gather(*[_post(client, url) for url in urls])
