"""Build and sign all JWT types for OpenID Federation 1.0."""

import json
import time

from authlib.jose import JsonWebKey, jwt

from app.core.models.signing_key import SigningKey
from app.exceptions import JWTError
from app.keys.manager import get_private_key_pem


def _load_private_key(signing_key: SigningKey) -> JsonWebKey:
    """Load a private key from a SigningKey model."""
    pem = get_private_key_pem(signing_key)
    key = JsonWebKey.import_key(pem, {"kty": "EC" if "ES" in signing_key.algorithm else "RSA"})
    return key


def build_entity_configuration(
    entity_id: str,
    signing_key: SigningKey,
    jwks: dict,
    authority_hints: list[str] | None = None,
    metadata: dict | None = None,
    contacts: list[str] | None = None,
    trust_marks: list[dict] | None = None,
    trust_mark_issuers: dict | None = None,
    expires_in: int = 604800,
) -> str:
    """Build a self-signed entity configuration JWT (Section 6)."""
    try:
        now = int(time.time())
        payload = {
            "iss": entity_id,
            "sub": entity_id,
            "iat": now,
            "exp": now + expires_in,
            "jwks": jwks,
        }
        if authority_hints:
            payload["authority_hints"] = authority_hints
        if metadata:
            payload["metadata"] = metadata
        if contacts:
            payload["contacts"] = contacts
        if trust_marks:
            payload["trust_marks"] = trust_marks
        if trust_mark_issuers:
            payload["trust_mark_issuers"] = trust_mark_issuers

        header = {
            "alg": signing_key.algorithm,
            "kid": signing_key.kid,
            "typ": "entity-statement+jwt",
        }
        key = _load_private_key(signing_key)
        return jwt.encode(header, payload, key).decode()
    except Exception as exc:
        raise JWTError(f"Failed to build entity configuration: {exc}") from exc


def build_subordinate_statement(
    issuer_entity_id: str,
    subject_entity_id: str,
    signing_key: SigningKey,
    subject_jwks: dict,
    metadata_override: dict | None = None,
    metadata_policy: dict | None = None,
    constraints: dict | None = None,
    trust_marks: list[dict] | None = None,
    expires_in: int = 604800,
) -> str:
    """Build a subordinate statement JWT (Section 7)."""
    try:
        now = int(time.time())
        payload = {
            "iss": issuer_entity_id,
            "sub": subject_entity_id,
            "iat": now,
            "exp": now + expires_in,
            "jwks": subject_jwks,
        }
        if metadata_override:
            payload["metadata"] = metadata_override
        if metadata_policy:
            payload["metadata_policy"] = metadata_policy
        if constraints:
            payload["constraints"] = constraints
        if trust_marks:
            payload["trust_marks"] = trust_marks

        header = {
            "alg": signing_key.algorithm,
            "kid": signing_key.kid,
            "typ": "entity-statement+jwt",
        }
        key = _load_private_key(signing_key)
        return jwt.encode(header, payload, key).decode()
    except Exception as exc:
        raise JWTError(f"Failed to build subordinate statement: {exc}") from exc


def build_trust_mark_jwt(
    issuer_entity_id: str,
    subject_entity_id: str,
    trust_mark_id: str,
    signing_key: SigningKey,
    ref: str | None = None,
    logo_uri: str | None = None,
    expires_in: int | None = None,
) -> str:
    """Build a trust mark JWT (Section 8)."""
    try:
        now = int(time.time())
        payload = {
            "iss": issuer_entity_id,
            "sub": subject_entity_id,
            "id": trust_mark_id,
            "iat": now,
        }
        if expires_in:
            payload["exp"] = now + expires_in
        if ref:
            payload["ref"] = ref
        if logo_uri:
            payload["logo_uri"] = logo_uri

        header = {
            "alg": signing_key.algorithm,
            "kid": signing_key.kid,
            "typ": "trust-mark+jwt",
        }
        key = _load_private_key(signing_key)
        return jwt.encode(header, payload, key).decode()
    except Exception as exc:
        raise JWTError(f"Failed to build trust mark: {exc}") from exc


def build_resolve_response(
    issuer_entity_id: str,
    subject_entity_id: str,
    signing_key: SigningKey,
    metadata: dict,
    trust_chain: list[str],
    trust_marks: list[dict] | None = None,
    expires_in: int = 604800,
) -> str:
    """Build a resolve response JWT (Section 10.2)."""
    try:
        now = int(time.time())
        payload = {
            "iss": issuer_entity_id,
            "sub": subject_entity_id,
            "iat": now,
            "exp": now + expires_in,
            "metadata": metadata,
            "trust_chain": trust_chain,
        }
        if trust_marks:
            payload["trust_marks"] = trust_marks

        header = {
            "alg": signing_key.algorithm,
            "kid": signing_key.kid,
            "typ": "resolve-response+jwt",
        }
        key = _load_private_key(signing_key)
        return jwt.encode(header, payload, key).decode()
    except Exception as exc:
        raise JWTError(f"Failed to build resolve response: {exc}") from exc


def build_trust_mark_status_response(
    trust_mark_id: str,
    subject_entity_id: str,
    active: bool,
) -> dict:
    """Build trust mark status response (plain JSON, not JWT)."""
    return {
        "sub": subject_entity_id,
        "id": trust_mark_id,
        "active": active,
    }


def decode_jwt_unverified(token: str) -> tuple[dict, dict]:
    """Decode a JWT without verification (for inspection). Returns (header, payload)."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise JWTError("Invalid JWT format")

        import base64

        def _pad_b64(s: str) -> str:
            return s + "=" * (4 - len(s) % 4)

        header = json.loads(base64.urlsafe_b64decode(_pad_b64(parts[0])))
        payload = json.loads(base64.urlsafe_b64decode(_pad_b64(parts[1])))
        return header, payload
    except JWTError:
        raise
    except Exception as exc:
        raise JWTError(f"Failed to decode JWT: {exc}") from exc
