"""Tests for JWT builder and validator."""

import json

import pytest

from app.core.models.signing_key import KeyAlgorithm, KeyStatus, SigningKey
from app.federation.jwt_builder import (
    build_entity_configuration,
    build_subordinate_statement,
    build_trust_mark_jwt,
    decode_jwt_unverified,
)
from app.federation.jwt_validator import (
    is_jwt_expired,
    verify_self_signed_jwt,
    verify_subordinate_statement,
)
from app.keys.manager import _compute_thumbprint
from app.keys.storage import encrypt_private_key

from authlib.jose import JsonWebKey


@pytest.fixture
def es256_key_pair():
    """Generate an ES256 key pair for testing."""
    key = JsonWebKey.generate_key("EC", "P-256", is_private=True)
    private_pem = key.as_pem(is_private=True)
    public_jwk = key.as_dict(is_private=False)
    kid = _compute_thumbprint(public_jwk)
    public_jwk["kid"] = kid
    public_jwk["use"] = "sig"
    public_jwk["alg"] = "ES256"

    signing_key = SigningKey(
        entity_id="00000000-0000-0000-0000-000000000001",
        kid=kid,
        algorithm=KeyAlgorithm.ES256,
        public_key_jwk=json.dumps(public_jwk),
        private_key_encrypted=encrypt_private_key(private_pem),
    )
    return signing_key, public_jwk


def test_build_and_verify_entity_configuration(es256_key_pair):
    signing_key, public_jwk = es256_key_pair
    jwks = {"keys": [public_jwk]}

    token = build_entity_configuration(
        entity_id="https://test.example.com",
        signing_key=signing_key,
        jwks=jwks,
        metadata={"federation_entity": {"name": "Test"}},
        expires_in=3600,
    )

    # Should be a valid JWT
    assert len(token.split(".")) == 3

    # Verify self-signed
    claims = verify_self_signed_jwt(token)
    assert claims["iss"] == "https://test.example.com"
    assert claims["sub"] == "https://test.example.com"
    assert claims["jwks"] == jwks
    assert claims["metadata"]["federation_entity"]["name"] == "Test"


def test_build_and_verify_subordinate_statement(es256_key_pair):
    signing_key, public_jwk = es256_key_pair
    issuer_jwks = {"keys": [public_jwk]}

    # Generate subject key
    sub_key = JsonWebKey.generate_key("EC", "P-256", is_private=True)
    sub_jwk = sub_key.as_dict(is_private=False)
    sub_jwk["kid"] = _compute_thumbprint(sub_jwk)
    subject_jwks = {"keys": [sub_jwk]}

    token = build_subordinate_statement(
        issuer_entity_id="https://ta.example.com",
        subject_entity_id="https://sub.example.com",
        signing_key=signing_key,
        subject_jwks=subject_jwks,
        expires_in=3600,
    )

    claims = verify_subordinate_statement(token, issuer_jwks)
    assert claims["iss"] == "https://ta.example.com"
    assert claims["sub"] == "https://sub.example.com"


def test_build_trust_mark(es256_key_pair):
    signing_key, _ = es256_key_pair

    token = build_trust_mark_jwt(
        issuer_entity_id="https://ta.example.com",
        subject_entity_id="https://sub.example.com",
        trust_mark_id="https://ta.example.com/tm/certified",
        signing_key=signing_key,
        expires_in=86400,
    )

    header, payload = decode_jwt_unverified(token)
    assert header["typ"] == "trust-mark+jwt"
    assert payload["iss"] == "https://ta.example.com"
    assert payload["sub"] == "https://sub.example.com"
    assert payload["id"] == "https://ta.example.com/tm/certified"


def test_decode_jwt_unverified(es256_key_pair):
    signing_key, public_jwk = es256_key_pair
    jwks = {"keys": [public_jwk]}

    token = build_entity_configuration(
        entity_id="https://decode.example.com",
        signing_key=signing_key,
        jwks=jwks,
    )

    header, payload = decode_jwt_unverified(token)
    assert header["alg"] == "ES256"
    assert payload["iss"] == "https://decode.example.com"


def test_is_jwt_expired(es256_key_pair):
    signing_key, public_jwk = es256_key_pair
    jwks = {"keys": [public_jwk]}

    # Not expired
    token = build_entity_configuration(
        entity_id="https://test.example.com",
        signing_key=signing_key,
        jwks=jwks,
        expires_in=3600,
    )
    assert is_jwt_expired(token) is False

    # Expired (negative expires_in)
    token_expired = build_entity_configuration(
        entity_id="https://test.example.com",
        signing_key=signing_key,
        jwks=jwks,
        expires_in=-1,
    )
    assert is_jwt_expired(token_expired) is True
