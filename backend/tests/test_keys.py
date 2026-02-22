"""Tests for key management."""

import json

import pytest
from httpx import AsyncClient

from app.keys.storage import decrypt_private_key, encrypt_private_key


def test_encrypt_decrypt_roundtrip():
    """Test that encryption/decryption is reversible."""
    original = b"-----BEGIN EC PRIVATE KEY-----\ntest_key_data\n-----END EC PRIVATE KEY-----"
    encrypted = encrypt_private_key(original)
    assert encrypted != original.decode()
    decrypted = decrypt_private_key(encrypted)
    assert decrypted == original


@pytest.mark.asyncio
async def test_key_generation_on_entity_create(client: AsyncClient):
    """Test that creating an entity generates a signing key."""
    resp = await client.post(
        "/api/entities/",
        json={
            "entity_id": "https://keygen.example.com",
            "name": "Keygen Test",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    jwks = data["jwks"]
    assert "keys" in jwks
    assert len(jwks["keys"]) == 1
    key = jwks["keys"][0]
    assert "kid" in key
    assert key["alg"] == "ES256"
    assert key["use"] == "sig"


@pytest.mark.asyncio
async def test_key_rotation(client: AsyncClient):
    """Test key rotation generates a new key with different kid."""
    create_resp = await client.post(
        "/api/entities/",
        json={
            "entity_id": "https://keyrotate.example.com",
            "name": "Key Rotate Test",
        },
    )
    entity_id = create_resp.json()["id"]
    old_kid = create_resp.json()["jwks"]["keys"][0]["kid"]

    rotate_resp = await client.post(f"/api/entities/{entity_id}/rotate-keys")
    assert rotate_resp.status_code == 200
    new_kid = rotate_resp.json()["jwks"]["keys"][0]["kid"]
    assert new_kid != old_kid
