"""Receive push notifications from the Trust Anchor about federation events."""

import logging

from fastapi import APIRouter, Header, HTTPException

from mock_waldur.federation_auth import FederationAuthError
from mock_waldur.trust_anchor_auth import verify_trust_anchor_jwt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/federation-notifications", tags=["Federation Notifications"])


@router.post("/")
async def receive_notification(
    authorization: str | None = Header(None),
) -> dict:
    """Receive a federation notification from the Trust Anchor.

    The notification JWT is passed as a Bearer token. Its payload contains
    an 'event' claim describing what happened plus event-specific fields.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:]

    try:
        iss, claims = await verify_trust_anchor_jwt(token)
    except FederationAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    event_type = claims.get("event", "unknown")

    if "revoked" in event_type or "removed" in event_type:
        logger.warning(
            "Federation notification from %s: %s — %s",
            iss,
            event_type,
            {k: v for k, v in claims.items() if k not in ("iss", "iat", "exp", "jti", "event")},
        )
    else:
        logger.info(
            "Federation notification from %s: %s — %s",
            iss,
            event_type,
            {k: v for k, v in claims.items() if k not in ("iss", "iat", "exp", "jti", "event")},
        )

    return {"received": True, "event": event_type}
