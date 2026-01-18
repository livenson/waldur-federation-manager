"""Tests for federation API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_federation(client: AsyncClient):
    """Test creating a new federation."""
    response = await client.post(
        "/api/v1/federations/",
        json={
            "name": "Test Federation",
            "slug": "test-fed",
            "admin_email": "admin@test.com",
            "description": "A test federation",
            "public_catalog": True,
            "require_approval": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Federation"
    assert data["slug"] == "test-fed"
    assert data["admin_email"] == "admin@test.com"
    assert data["status"] == "active"
    assert data["provider_count"] == 0
    assert data["offering_count"] == 0


@pytest.mark.asyncio
async def test_create_federation_duplicate_slug(client: AsyncClient):
    """Test creating federation with duplicate slug fails."""
    # Create first federation
    await client.post(
        "/api/v1/federations/",
        json={
            "name": "First Federation",
            "slug": "same-slug",
            "admin_email": "admin@test.com",
        },
    )

    # Try to create second with same slug
    response = await client.post(
        "/api/v1/federations/",
        json={
            "name": "Second Federation",
            "slug": "same-slug",
            "admin_email": "admin2@test.com",
        },
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_federations(client: AsyncClient):
    """Test listing federations."""
    # Create some federations
    for i in range(3):
        await client.post(
            "/api/v1/federations/",
            json={
                "name": f"Federation {i}",
                "slug": f"fed-{i}",
                "admin_email": f"admin{i}@test.com",
            },
        )

    response = await client.get("/api/v1/federations/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


@pytest.mark.asyncio
async def test_get_federation(client: AsyncClient):
    """Test getting a specific federation."""
    # Create federation
    await client.post(
        "/api/v1/federations/",
        json={
            "name": "Get Test",
            "slug": "get-test",
            "admin_email": "admin@test.com",
        },
    )

    response = await client.get("/api/v1/federations/get-test")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Get Test"
    assert data["slug"] == "get-test"


@pytest.mark.asyncio
async def test_get_federation_not_found(client: AsyncClient):
    """Test getting non-existent federation."""
    response = await client.get("/api/v1/federations/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_federation(client: AsyncClient):
    """Test updating a federation."""
    # Create federation
    await client.post(
        "/api/v1/federations/",
        json={
            "name": "Update Test",
            "slug": "update-test",
            "admin_email": "admin@test.com",
        },
    )

    # Update it
    response = await client.patch(
        "/api/v1/federations/update-test",
        json={
            "name": "Updated Name",
            "description": "Updated description",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_archive_federation(client: AsyncClient):
    """Test archiving a federation."""
    # Create federation
    await client.post(
        "/api/v1/federations/",
        json={
            "name": "Archive Test",
            "slug": "archive-test",
            "admin_email": "admin@test.com",
        },
    )

    # Archive it
    response = await client.delete("/api/v1/federations/archive-test")
    assert response.status_code == 204

    # Verify it's archived
    response = await client.get("/api/v1/federations/archive-test")
    data = response.json()
    assert data["status"] == "archived"
