"""Verify JWTs signed by the Trust Anchor (federation notifications).

Unlike federation_auth.verify_federation_jwt which looks up issuers in the
FederationEntity DB table, this module verifies JWTs signed by the Trust
Anchor itself by fetching the TA's JWKS from its well-known endpoint.
"""

import logging
import time

import httpx
from authlib.jose import JsonWebKey, jwt
from authlib.jose.errors import JoseError

from mock_waldur.config import get_settings
from mock_waldur.federation_auth import (
    FederationAuthError,
    _decode_header,
    _decode_payload_unverified,
    _find_key_by_kid,
)

logger = logging.getLogger(__name__)

# In-process JWKS cache: {ta_url: {"jwks": {...}, "fetched_at": float}}
_ta_jwks_cache: dict[str, dict] = {}


async def _fetch_ta_jwks(ta_url: str) -> dict:
    """Fetch the Trust Anchor's JWKS from its well-known endpoint.

    The TA's /.well-known/openid-federation returns a JWT whose payload
    contains a 'jwks' claim.
    """
    config_url = f"{ta_url.rstrip('/')}/.well-known/openid-federation"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(config_url)
        resp.raise_for_status()

    token = resp.text.strip()
    payload = _decode_payload_unverified(token)
    jwks = payload.get("jwks", {})
    if not jwks or not jwks.get("keys"):
        raise FederationAuthError(f"No JWKS found in TA configuration at {config_url}")
    return jwks


async def _get_ta_jwks(ta_url: str) -> dict:
    """Get TA JWKS with in-process caching."""
    settings = get_settings()
    cached = _ta_jwks_cache.get(ta_url)
    now = time.time()

    if cached and (now - cached["fetched_at"]) < settings.jwks_cache_ttl_seconds:
        return cached["jwks"]

    jwks = await _fetch_ta_jwks(ta_url)
    _ta_jwks_cache[ta_url] = {"jwks": jwks, "fetched_at": now}
    logger.info("Refreshed Trust Anchor JWKS from %s", ta_url)
    return jwks


async def verify_trust_anchor_jwt(token: str) -> tuple[str, dict]:
    """Verify a JWT signed by one of the configured Trust Anchors.

    Returns (issuer, claims) on success.
    Raises FederationAuthError on failure.
    """
    settings = get_settings()

    # Decode header + payload unverified
    try:
        header = _decode_header(token)
        payload = _decode_payload_unverified(token)
    except Exception as exc:
        raise FederationAuthError(f"Failed to decode JWT: {exc}")

    # Validate typ
    typ = header.get("typ", "")
    if typ != "federation-notification+jwt":
        raise FederationAuthError(f"Unexpected JWT typ: {typ}")

    iss = payload.get("iss")
    if not iss:
        raise FederationAuthError("JWT missing 'iss' claim")

    kid = header.get("kid")

    # Verify issuer is a known Trust Anchor
    trust_anchors = settings.get_trust_anchors()
    matching_ta = None
    for ta_url in trust_anchors:
        # The TA's entity_id is its base URL (possibly with path), so check
        # if the issuer starts with any configured TA URL
        if iss == ta_url or iss.startswith(ta_url.rstrip("/")):
            matching_ta = ta_url
            break

    if not matching_ta:
        raise FederationAuthError(f"Issuer {iss} is not a configured Trust Anchor")

    # Fetch TA JWKS (cached)
    try:
        jwks = await _get_ta_jwks(matching_ta)
    except FederationAuthError:
        raise
    except Exception as exc:
        raise FederationAuthError(f"Cannot fetch TA JWKS from {matching_ta}: {exc}")

    keys = jwks.get("keys", [])
    if not keys:
        raise FederationAuthError(f"No keys available for TA {matching_ta}")

    key_dict = _find_key_by_kid(keys, kid)
    if not key_dict:
        raise FederationAuthError(f"No matching key (kid={kid}) for TA {matching_ta}")

    # Verify signature
    try:
        key = JsonWebKey.import_key(key_dict)
        claims = jwt.decode(token, key)
        claims.validate()
    except JoseError as exc:
        raise FederationAuthError(f"JWT signature verification failed: {exc}")
    except Exception as exc:
        raise FederationAuthError(f"JWT verification error: {exc}")

    # Check expiry
    exp = claims.get("exp")
    if exp and int(time.time()) > exp:
        raise FederationAuthError("JWT has expired")

    return iss, dict(claims)
