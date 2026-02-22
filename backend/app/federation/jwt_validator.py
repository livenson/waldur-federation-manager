"""Verify JWT signatures for OpenID Federation 1.0."""

import json
import time
from base64 import urlsafe_b64decode

from authlib.jose import JsonWebKey, jwt
from authlib.jose.errors import JoseError

from app.exceptions import JWTError


def _pad_b64(s: str) -> str:
    return s + "=" * (4 - len(s) % 4)


def _decode_payload_unverified(token: str) -> dict:
    """Decode JWT payload without signature verification."""
    parts = token.split(".")
    if len(parts) != 3:
        raise JWTError("Invalid JWT format")
    return json.loads(urlsafe_b64decode(_pad_b64(parts[1])))


def _decode_header(token: str) -> dict:
    """Decode JWT header."""
    parts = token.split(".")
    if len(parts) != 3:
        raise JWTError("Invalid JWT format")
    return json.loads(urlsafe_b64decode(_pad_b64(parts[0])))


def _find_key_by_kid(keys: list[dict], kid: str) -> dict | None:
    """Find a JWK in a list by kid."""
    for k in keys:
        if k.get("kid") == kid:
            return k
    return keys[0] if keys else None


def verify_self_signed_jwt(token: str) -> dict:
    """Verify a self-signed entity configuration JWT.

    The JWT is verified against the jwks embedded in its own payload.
    """
    try:
        payload = _decode_payload_unverified(token)
        jwks_data = payload.get("jwks")
        if not jwks_data:
            raise JWTError("Entity configuration missing jwks claim")

        keys = jwks_data.get("keys", [])
        if not keys:
            raise JWTError("Entity configuration jwks is empty")

        header = _decode_header(token)
        kid = header.get("kid")
        key_dict = _find_key_by_kid(keys, kid) if kid else keys[0]
        if not key_dict:
            raise JWTError("No matching key found in jwks")

        key = JsonWebKey.import_key(key_dict)
        claims = jwt.decode(token, key)
        claims.validate()

        for claim in ("iss", "sub", "iat", "exp", "jwks"):
            if claim not in claims:
                raise JWTError(f"Missing required claim: {claim}")

        if claims["iss"] != claims["sub"]:
            raise JWTError("Entity configuration iss must equal sub")

        return dict(claims)
    except JWTError:
        raise
    except JoseError as exc:
        raise JWTError(f"JWT verification failed: {exc}") from exc
    except Exception as exc:
        raise JWTError(f"Unexpected error verifying JWT: {exc}") from exc


def verify_subordinate_statement(token: str, issuer_jwks: dict) -> dict:
    """Verify a subordinate statement JWT against the issuer's JWKS."""
    try:
        keys = issuer_jwks.get("keys", [])
        if not keys:
            raise JWTError("Issuer JWKS is empty")

        header = _decode_header(token)
        kid = header.get("kid")
        key_dict = _find_key_by_kid(keys, kid) if kid else keys[0]
        if not key_dict:
            raise JWTError("No matching key found in issuer jwks")

        key = JsonWebKey.import_key(key_dict)
        claims = jwt.decode(token, key)
        claims.validate()

        for claim in ("iss", "sub", "iat", "exp", "jwks"):
            if claim not in claims:
                raise JWTError(f"Missing required claim: {claim}")

        return dict(claims)
    except JWTError:
        raise
    except JoseError as exc:
        raise JWTError(f"Subordinate statement verification failed: {exc}") from exc
    except Exception as exc:
        raise JWTError(f"Unexpected error: {exc}") from exc


def verify_trust_mark(token: str, issuer_jwks: dict) -> dict:
    """Verify a trust mark JWT against the issuer's JWKS."""
    try:
        keys = issuer_jwks.get("keys", [])
        if not keys:
            raise JWTError("Issuer JWKS is empty")

        header = _decode_header(token)
        kid = header.get("kid")
        key_dict = _find_key_by_kid(keys, kid) if kid else keys[0]
        if not key_dict:
            raise JWTError("No matching key found in issuer jwks")

        key = JsonWebKey.import_key(key_dict)
        claims = jwt.decode(token, key)
        claims.validate()

        for claim in ("iss", "sub", "id", "iat"):
            if claim not in claims:
                raise JWTError(f"Missing required trust mark claim: {claim}")

        return dict(claims)
    except JWTError:
        raise
    except JoseError as exc:
        raise JWTError(f"Trust mark verification failed: {exc}") from exc
    except Exception as exc:
        raise JWTError(f"Unexpected error: {exc}") from exc


def is_jwt_expired(token: str) -> bool:
    """Check if a JWT is expired without full verification."""
    try:
        payload = _decode_payload_unverified(token)
        exp = payload.get("exp")
        if exp is None:
            return False
        return int(time.time()) > exp
    except Exception:
        return True
