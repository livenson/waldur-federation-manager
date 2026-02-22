"""Tests for trust mark management."""

import pytest
from httpx import AsyncClient


async def _setup_ta(client: AsyncClient) -> str:
    """Helper: ensure TA exists and is active."""
    resp = await client.post(
        "/api/entities/",
        json={
            "entity_id": "https://federation.waldur.example.com",
            "name": "Trust Anchor",
            "entity_types": ["federation_entity"],
        },
    )
    ta_id = resp.json()["id"]
    await client.post(f"/api/entities/{ta_id}/activate")
    return ta_id


async def _create_active_entity(client: AsyncClient, entity_id: str, name: str) -> str:
    """Helper: create and activate an entity."""
    resp = await client.post(
        "/api/entities/",
        json={"entity_id": entity_id, "name": name},
    )
    eid = resp.json()["id"]
    await client.post(f"/api/entities/{eid}/activate")
    return eid


@pytest.mark.asyncio
async def test_create_trust_mark_definition(client: AsyncClient):
    resp = await client.post(
        "/api/trust-marks/definitions",
        json={
            "trust_mark_id": "https://federation.example.com/tm/certified",
            "name": "Certified Provider",
            "description": "Certified HPC provider",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Certified Provider"


@pytest.mark.asyncio
async def test_list_definitions(client: AsyncClient):
    await client.post(
        "/api/trust-marks/definitions",
        json={
            "trust_mark_id": "https://federation.example.com/tm/list-test",
            "name": "List Test",
        },
    )
    resp = await client.get("/api/trust-marks/definitions")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_issue_trust_mark(client: AsyncClient):
    await _setup_ta(client)
    await _create_active_entity(client, "https://lumi.example.com", "LUMI")

    # Create definition
    await client.post(
        "/api/trust-marks/definitions",
        json={
            "trust_mark_id": "https://federation.example.com/tm/issue-test",
            "name": "Issue Test",
        },
    )

    # Issue trust mark
    resp = await client.post(
        "/api/trust-marks/issue",
        json={
            "trust_mark_id": "https://federation.example.com/tm/issue-test",
            "subject_entity_id": "https://lumi.example.com",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "active"
    assert data["jwt"]  # Should contain a JWT
    assert len(data["jwt"].split(".")) == 3


@pytest.mark.asyncio
async def test_revoke_trust_mark(client: AsyncClient):
    await _setup_ta(client)
    await _create_active_entity(client, "https://revoke-tm.example.com", "Revoke TM")

    await client.post(
        "/api/trust-marks/definitions",
        json={
            "trust_mark_id": "https://federation.example.com/tm/revoke-test",
            "name": "Revoke Test",
        },
    )

    issue_resp = await client.post(
        "/api/trust-marks/issue",
        json={
            "trust_mark_id": "https://federation.example.com/tm/revoke-test",
            "subject_entity_id": "https://revoke-tm.example.com",
        },
    )
    mark_id = issue_resp.json()["id"]

    resp = await client.post(
        f"/api/trust-marks/{mark_id}/revoke",
        json={"reason": "Non-compliance"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"
    assert resp.json()["revocation_reason"] == "Non-compliance"


@pytest.mark.asyncio
async def test_list_trust_marks(client: AsyncClient):
    await _setup_ta(client)
    await _create_active_entity(client, "https://list-tm.example.com", "List TM")

    await client.post(
        "/api/trust-marks/definitions",
        json={
            "trust_mark_id": "https://federation.example.com/tm/list-test-2",
            "name": "List Test 2",
        },
    )

    await client.post(
        "/api/trust-marks/issue",
        json={
            "trust_mark_id": "https://federation.example.com/tm/list-test-2",
            "subject_entity_id": "https://list-tm.example.com",
        },
    )

    resp = await client.get("/api/trust-marks/")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
