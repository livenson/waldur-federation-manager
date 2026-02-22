"""Tests for federation protocol endpoints."""

import pytest
from httpx import AsyncClient


async def _setup_ta_and_entity(client: AsyncClient) -> tuple[str, str]:
    """Helper: create TA and an active entity, return (ta_uuid, entity_uuid)."""
    # Create TA
    ta_resp = await client.post(
        "/api/entities/",
        json={
            "entity_id": "https://federation.waldur.example.com",
            "name": "Trust Anchor",
            "entity_types": ["federation_entity"],
        },
    )
    ta_id = ta_resp.json()["id"]
    await client.post(f"/api/entities/{ta_id}/activate")

    # Create subordinate entity
    sub_resp = await client.post(
        "/api/entities/",
        json={
            "entity_id": "https://lumi.example.com",
            "name": "LUMI",
            "entity_types": ["openid_relying_party"],
        },
    )
    sub_id = sub_resp.json()["id"]
    await client.post(f"/api/entities/{sub_id}/activate")

    return ta_id, sub_id


@pytest.mark.asyncio
async def test_entity_configuration_endpoint(client: AsyncClient):
    """Test /.well-known/openid-federation returns a JWT."""
    await _setup_ta_and_entity(client)

    resp = await client.get("/.well-known/openid-federation")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/entity-statement+jwt"
    # JWT has 3 parts separated by dots
    assert len(resp.text.split(".")) == 3


@pytest.mark.asyncio
async def test_fetch_endpoint(client: AsyncClient):
    """Test /federation/fetch?sub= returns a subordinate statement."""
    await _setup_ta_and_entity(client)

    resp = await client.get(
        "/federation/fetch", params={"sub": "https://lumi.example.com"}
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/entity-statement+jwt"
    assert len(resp.text.split(".")) == 3


@pytest.mark.asyncio
async def test_fetch_nonexistent(client: AsyncClient):
    """Test fetching statement for unknown entity returns 404."""
    resp = await client.get(
        "/federation/fetch", params={"sub": "https://nonexistent.example.com"}
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_endpoint(client: AsyncClient):
    """Test /federation/list returns subordinate entity IDs."""
    await _setup_ta_and_entity(client)

    resp = await client.get("/federation/list")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert "https://lumi.example.com" in data


@pytest.mark.asyncio
async def test_resolve_endpoint(client: AsyncClient):
    """Test /federation/resolve returns a resolve response JWT."""
    await _setup_ta_and_entity(client)

    resp = await client.get(
        "/federation/resolve",
        params={"sub": "https://lumi.example.com"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/resolve-response+jwt"


@pytest.mark.asyncio
async def test_historical_keys_endpoint(client: AsyncClient):
    """Test /federation/historical_keys returns a JWKS."""
    await _setup_ta_and_entity(client)

    resp = await client.get("/federation/historical_keys")
    assert resp.status_code == 200
    data = resp.json()
    assert "keys" in data
    assert len(data["keys"]) >= 1


@pytest.mark.asyncio
async def test_trust_mark_status_endpoint(client: AsyncClient):
    """Test /federation/trust_mark_status returns status."""
    resp = await client.get(
        "/federation/trust_mark_status",
        params={
            "sub": "https://lumi.example.com",
            "id": "https://federation.example.com/trust_mark/certified",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["active"] is False  # No marks issued yet


@pytest.mark.asyncio
async def test_trust_mark_list_endpoint(client: AsyncClient):
    """Test /federation/trust_mark_list returns a list."""
    resp = await client.get("/federation/trust_mark_list")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
