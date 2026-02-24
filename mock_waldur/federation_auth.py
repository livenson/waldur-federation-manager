"""JWT authentication against federation JWKS for the mock Waldur instance."""

import json
import logging
import time
from base64 import urlsafe_b64decode
from datetime import datetime

import httpx
from authlib.jose import JsonWebKey, jwt
from authlib.jose.errors import JoseError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mock_waldur.config import get_settings
from mock_waldur.models import FederationEntity

logger = logging.getLogger(__name__)


class FederationAuthError(Exception):
    """Raised when federation JWT verification fails."""

    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _pad_b64(s: str) -> str:
    return s + "=" * (4 - len(s) % 4)


def _decode_header(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise FederationAuthError("Invalid JWT format")
    return json.loads(urlsafe_b64decode(_pad_b64(parts[0])))


def _decode_payload_unverified(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise FederationAuthError("Invalid JWT format")
    return json.loads(urlsafe_b64decode(_pad_b64(parts[1])))


def _find_key_by_kid(keys: list[dict], kid: str | None) -> dict | None:
    if kid:
        for k in keys:
            if k.get("kid") == kid:
                return k
    return keys[0] if keys else None


async def _refresh_jwks(entity: FederationEntity) -> dict:
    """Fetch JWKS from the entity's well-known endpoint."""
    entity_config_url = f"{entity.entity_id.rstrip('/')}/.well-known/openid-federation"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(entity_config_url)
            resp.raise_for_status()
    except httpx.HTTPError:
        # Fall back to Trust Anchor's fetch endpoint
        fetch_url = f"{entity.trust_anchor_url.rstrip('/')}/federation/fetch"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(fetch_url, params={"sub": entity.entity_id})
            resp.raise_for_status()

    # The response is a JWT — decode payload unverified to extract jwks
    token = resp.text.strip()
    payload = _decode_payload_unverified(token)
    jwks = payload.get("jwks", {})
    if not jwks or not jwks.get("keys"):
        raise FederationAuthError(f"No JWKS found in configuration for {entity.entity_id}")
    return jwks


async def verify_federation_jwt(
    token: str, session: AsyncSession
) -> tuple[str, dict]:
    """Verify a federation JWT and return (entity_id, claims).

    Flow:
    1. Decode header and payload (unverified) to get iss and kid
    2. Look up FederationEntity by entity_id == iss
    3. Refresh JWKS if cache is stale
    4. Verify JWT signature against JWKS
    5. Check expiry
    """
    settings = get_settings()

    # 1. Decode unverified
    try:
        header = _decode_header(token)
        payload = _decode_payload_unverified(token)
    except Exception as exc:
        raise FederationAuthError(f"Failed to decode JWT: {exc}")

    iss = payload.get("iss")
    if not iss:
        raise FederationAuthError("JWT missing 'iss' claim")

    kid = header.get("kid")

    # 2. Look up FederationEntity
    result = await session.execute(
        select(FederationEntity).where(
            FederationEntity.entity_id == iss,
            FederationEntity.is_active == True,  # noqa: E712
        )
    )
    entity = result.scalars().first()
    if not entity:
        raise FederationAuthError(f"Unknown or inactive federation entity: {iss}")

    # 3. Refresh JWKS if stale
    jwks = json.loads(entity.jwks) if entity.jwks and entity.jwks != "{}" else {}
    cache_age = None
    if entity.jwks_updated_at:
        cache_age = (datetime.utcnow() - entity.jwks_updated_at).total_seconds()

    if not jwks.get("keys") or cache_age is None or cache_age > settings.jwks_cache_ttl_seconds:
        try:
            jwks = await _refresh_jwks(entity)
            entity.jwks = json.dumps(jwks)
            entity.jwks_updated_at = datetime.utcnow()
            entity.updated_at = datetime.utcnow()
            session.add(entity)
            await session.commit()
            await session.refresh(entity)
            logger.info("Refreshed JWKS for %s", iss)
        except Exception as exc:
            # If refresh fails but we have cached JWKS, use those
            if jwks.get("keys"):
                logger.warning("JWKS refresh failed for %s, using cache: %s", iss, exc)
            else:
                raise FederationAuthError(f"Cannot fetch JWKS for {iss}: {exc}")

    # 4. Verify signature
    keys = jwks.get("keys", [])
    if not keys:
        raise FederationAuthError(f"No keys available for {iss}")

    key_dict = _find_key_by_kid(keys, kid)
    if not key_dict:
        raise FederationAuthError(f"No matching key (kid={kid}) for {iss}")

    try:
        key = JsonWebKey.import_key(key_dict)
        claims = jwt.decode(token, key)
        claims.validate()
    except JoseError as exc:
        raise FederationAuthError(f"JWT signature verification failed: {exc}")
    except Exception as exc:
        raise FederationAuthError(f"JWT verification error: {exc}")

    # 5. Check expiry
    exp = claims.get("exp")
    if exp and int(time.time()) > exp:
        raise FederationAuthError("JWT has expired")

    return iss, dict(claims)
