"""Key generation, rotation, and JWK management using authlib."""

import hashlib
import json
import uuid
from base64 import urlsafe_b64encode
from datetime import datetime

from authlib.jose import JsonWebKey
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models.signing_key import KeyAlgorithm, KeyStatus, SigningKey
from app.keys.storage import decrypt_private_key, encrypt_private_key


def _compute_thumbprint(jwk_dict: dict) -> str:
    """Compute JWK Thumbprint (RFC 7638) as kid."""
    kty = jwk_dict.get("kty", "")
    if kty == "EC":
        required = {"crv", "kty", "x", "y"}
    elif kty == "RSA":
        required = {"e", "kty", "n"}
    else:
        required = set(jwk_dict.keys()) - {"kid", "use", "alg", "key_ops"}

    canonical = json.dumps(
        {k: jwk_dict[k] for k in sorted(required) if k in jwk_dict},
        separators=(",", ":"),
        sort_keys=True,
    )
    digest = hashlib.sha256(canonical.encode()).digest()
    return urlsafe_b64encode(digest).rstrip(b"=").decode()


async def generate_key(
    session: AsyncSession,
    entity_id: uuid.UUID,
    algorithm: KeyAlgorithm = KeyAlgorithm.ES256,
) -> SigningKey:
    """Generate a new signing key pair for an entity."""
    if algorithm == KeyAlgorithm.ES256:
        key = JsonWebKey.generate_key("EC", "P-256", is_private=True)
    else:
        key = JsonWebKey.generate_key("RSA", 2048, is_private=True)

    private_pem = key.as_pem(is_private=True)
    public_jwk = key.as_dict(is_private=False)

    kid = _compute_thumbprint(public_jwk)
    public_jwk["kid"] = kid
    public_jwk["use"] = "sig"
    public_jwk["alg"] = algorithm.value

    signing_key = SigningKey(
        entity_id=entity_id,
        kid=kid,
        algorithm=algorithm,
        public_key_jwk=json.dumps(public_jwk),
        private_key_encrypted=encrypt_private_key(private_pem),
    )
    session.add(signing_key)
    await session.commit()
    await session.refresh(signing_key)
    return signing_key


async def get_active_key(session: AsyncSession, entity_id: uuid.UUID) -> SigningKey | None:
    """Get the first active signing key for an entity."""
    result = await session.execute(
        select(SigningKey).where(
            SigningKey.entity_id == entity_id,
            SigningKey.status == KeyStatus.ACTIVE,
        )
    )
    return result.scalars().first()


async def get_entity_jwks(session: AsyncSession, entity_id: uuid.UUID) -> dict:
    """Build a JWKS (JSON Web Key Set) containing all active keys for an entity."""
    result = await session.execute(
        select(SigningKey).where(
            SigningKey.entity_id == entity_id,
            SigningKey.status == KeyStatus.ACTIVE,
        )
    )
    keys = result.scalars().all()
    return {"keys": [json.loads(k.public_key_jwk) for k in keys]}


async def get_historical_jwks(session: AsyncSession, entity_id: uuid.UUID) -> dict:
    """Build a JWKS including rotated and revoked keys (for historical verification)."""
    result = await session.execute(
        select(SigningKey).where(SigningKey.entity_id == entity_id)
    )
    keys = result.scalars().all()
    return {"keys": [json.loads(k.public_key_jwk) for k in keys]}


async def rotate_key(
    session: AsyncSession,
    entity_id: uuid.UUID,
    algorithm: KeyAlgorithm = KeyAlgorithm.ES256,
) -> SigningKey:
    """Rotate keys: mark all active keys as ROTATED, generate a new one."""
    result = await session.execute(
        select(SigningKey).where(
            SigningKey.entity_id == entity_id,
            SigningKey.status == KeyStatus.ACTIVE,
        )
    )
    for key in result.scalars().all():
        key.status = KeyStatus.ROTATED
        key.rotated_at = datetime.utcnow()
        session.add(key)

    new_key = await generate_key(session, entity_id, algorithm)
    return new_key


async def revoke_key(session: AsyncSession, kid: str) -> SigningKey:
    """Revoke a specific key by kid."""
    result = await session.execute(select(SigningKey).where(SigningKey.kid == kid))
    key = result.scalars().first()
    if not key:
        from app.exceptions import KeyNotFoundError

        raise KeyNotFoundError(kid)
    key.status = KeyStatus.REVOKED
    key.revoked_at = datetime.utcnow()
    session.add(key)
    await session.commit()
    await session.refresh(key)
    return key


def get_private_key_pem(signing_key: SigningKey) -> bytes:
    """Decrypt and return the private key PEM bytes."""
    return decrypt_private_key(signing_key.private_key_encrypted)
