"""Tests for entity management API."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_entity(client: AsyncClient):
    """Test creating a new entity."""
    resp = await client.post(
        "/api/entities/",
        json={
            "entity_id": "https://lumi.example.com",
            "name": "LUMI Supercomputer",
            "organization": "CSC Finland",
            "country": "FI",
            "entity_types": ["openid_relying_party"],
            "contacts": ["admin@lumi.example.com"],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["entity_id"] == "https://lumi.example.com"
    assert data["name"] == "LUMI Supercomputer"
    assert data["status"] == "draft"
    assert data["jwks"]["keys"]  # Should have generated keys


@pytest.mark.asyncio
async def test_create_entity_duplicate(client: AsyncClient):
    """Test creating duplicate entity fails."""
    payload = {
        "entity_id": "https://dup.example.com",
        "name": "Duplicate",
    }
    resp1 = await client.post("/api/entities/", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/entities/", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_list_entities(client: AsyncClient):
    """Test listing entities."""
    await client.post(
        "/api/entities/",
        json={"entity_id": "https://e1.example.com", "name": "Entity 1"},
    )
    await client.post(
        "/api/entities/",
        json={"entity_id": "https://e2.example.com", "name": "Entity 2"},
    )

    resp = await client.get("/api/entities/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2


@pytest.mark.asyncio
async def test_get_entity(client: AsyncClient):
    """Test getting a single entity."""
    create_resp = await client.post(
        "/api/entities/",
        json={"entity_id": "https://get.example.com", "name": "Get Test"},
    )
    entity_id = create_resp.json()["id"]

    resp = await client.get(f"/api/entities/{entity_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Get Test"


@pytest.mark.asyncio
async def test_update_entity(client: AsyncClient):
    """Test updating an entity."""
    create_resp = await client.post(
        "/api/entities/",
        json={"entity_id": "https://update.example.com", "name": "Before"},
    )
    entity_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/entities/{entity_id}",
        json={"name": "After", "country": "DE"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "After"
    assert resp.json()["country"] == "DE"


@pytest.mark.asyncio
async def test_activate_entity(client: AsyncClient):
    """Test activating a draft entity."""
    # First ensure TA exists
    await client.post(
        "/api/entities/",
        json={
            "entity_id": "https://federation.waldur.example.com",
            "name": "Trust Anchor",
        },
    )
    ta_resp = await client.get("/api/entities/")
    for e in ta_resp.json()["entities"]:
        if e["entity_id"] == "https://federation.waldur.example.com":
            await client.post(f"/api/entities/{e['id']}/activate")
            break

    # Now create and activate a subordinate
    create_resp = await client.post(
        "/api/entities/",
        json={"entity_id": "https://activate.example.com", "name": "Activate Test"},
    )
    entity_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "draft"

    resp = await client.post(f"/api/entities/{entity_id}/activate")
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"


@pytest.mark.asyncio
async def test_suspend_entity(client: AsyncClient):
    """Test suspending an active entity."""
    create_resp = await client.post(
        "/api/entities/",
        json={"entity_id": "https://suspend.example.com", "name": "Suspend Test"},
    )
    entity_id = create_resp.json()["id"]

    # Activate first
    await client.post(f"/api/entities/{entity_id}/activate")

    # Now suspend
    resp = await client.post(f"/api/entities/{entity_id}/suspend")
    assert resp.status_code == 200
    assert resp.json()["status"] == "suspended"


@pytest.mark.asyncio
async def test_revoke_entity(client: AsyncClient):
    """Test revoking an entity."""
    create_resp = await client.post(
        "/api/entities/",
        json={"entity_id": "https://revoke.example.com", "name": "Revoke Test"},
    )
    entity_id = create_resp.json()["id"]

    resp = await client.post(f"/api/entities/{entity_id}/revoke")
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"


@pytest.mark.asyncio
async def test_delete_draft_entity(client: AsyncClient):
    """Test deleting a draft entity."""
    create_resp = await client.post(
        "/api/entities/",
        json={"entity_id": "https://delete.example.com", "name": "Delete Test"},
    )
    entity_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/entities/{entity_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_active_entity_fails(client: AsyncClient):
    """Test that deleting an active entity fails."""
    create_resp = await client.post(
        "/api/entities/",
        json={"entity_id": "https://no-delete.example.com", "name": "No Delete"},
    )
    entity_id = create_resp.json()["id"]
    await client.post(f"/api/entities/{entity_id}/activate")

    resp = await client.delete(f"/api/entities/{entity_id}")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_rotate_keys(client: AsyncClient):
    """Test key rotation for an entity."""
    create_resp = await client.post(
        "/api/entities/",
        json={"entity_id": "https://rotate.example.com", "name": "Rotate Test"},
    )
    entity_id = create_resp.json()["id"]
    old_jwks = create_resp.json()["jwks"]

    resp = await client.post(f"/api/entities/{entity_id}/rotate-keys")
    assert resp.status_code == 200
    new_jwks = resp.json()["jwks"]
    assert new_jwks["keys"][0]["kid"] != old_jwks["keys"][0]["kid"]
