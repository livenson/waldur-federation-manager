"""Tests for catalog API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.fixture
async def federation_with_provider(client: AsyncClient):
    """Create a federation with a provider for testing."""
    # Create federation
    fed_response = await client.post(
        "/api/v1/federations/",
        json={
            "name": "Catalog Test Federation",
            "slug": "catalog-test",
            "admin_email": "admin@test.com",
            "require_approval": False,
        },
    )
    federation = fed_response.json()

    # Create provider
    prov_response = await client.post(
        "/api/v1/federations/catalog-test/providers/",
        json={
            "name": "Test Provider",
            "waldur_url": "https://waldur.example.com",
            "country": "DE",
            "main_contact_email": "provider@test.com",
        },
    )
    provider = prov_response.json()

    return federation, provider


@pytest.mark.asyncio
async def test_create_offering(client: AsyncClient, federation_with_provider):
    """Test creating an offering."""
    federation, provider = federation_with_provider

    response = await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Test Offering",
            "tagline": "A test offering for the catalog",
            "description": "This is a test offering with full description.",
            "cpv_codes": ["72000000", "72200000"],
            "categories": ["compute"],
            "pricing_model": "subscription",
            "lifecycle_status": "production",
            "trl": 9,
            "geographic_availability": ["DE", "FR", "NL"],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Offering"
    assert data["provider_id"] == provider["id"]
    assert data["cpv_codes"] == ["72000000", "72200000"]
    assert data["lifecycle_status"] == "production"
    assert data["sync_status"] == "manual"


@pytest.mark.asyncio
async def test_browse_catalog(client: AsyncClient, federation_with_provider):
    """Test browsing the catalog."""
    federation, provider = federation_with_provider

    # Create some offerings
    for i in range(5):
        await client.post(
            "/api/v1/federations/catalog-test/offerings/",
            json={
                "provider_id": provider["id"],
                "name": f"Offering {i}",
                "categories": ["compute"] if i % 2 == 0 else ["storage"],
                "pricing_model": "free" if i % 2 == 0 else "subscription",
            },
        )

    # Browse all
    response = await client.get("/api/v1/federations/catalog-test/catalog/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5


@pytest.mark.asyncio
async def test_browse_catalog_with_filters(client: AsyncClient, federation_with_provider):
    """Test browsing catalog with filters."""
    federation, provider = federation_with_provider

    # Create offerings
    await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Production Service",
            "lifecycle_status": "production",
            "pricing_model": "free",
        },
    )
    await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Beta Service",
            "lifecycle_status": "beta",
            "pricing_model": "subscription",
        },
    )

    # Filter by lifecycle status
    response = await client.get(
        "/api/v1/federations/catalog-test/catalog/?lifecycle_status=production"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Production Service"

    # Filter by pricing model
    response = await client.get(
        "/api/v1/federations/catalog-test/catalog/?pricing_model=subscription"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Beta Service"


@pytest.mark.asyncio
async def test_search_catalog(client: AsyncClient, federation_with_provider):
    """Test searching the catalog."""
    federation, provider = federation_with_provider

    # Create offerings
    await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Cloud Computing Service",
            "description": "HPC computing in the cloud",
        },
    )
    await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Data Storage",
            "description": "Secure data storage",
        },
    )

    # Search for computing
    response = await client.get(
        "/api/v1/federations/catalog-test/catalog/search/?q=computing"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert "Computing" in data[0]["name"]


@pytest.mark.asyncio
async def test_get_offering_detail(client: AsyncClient, federation_with_provider):
    """Test getting offering details."""
    federation, provider = federation_with_provider

    # Create offering
    create_response = await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Detail Test Offering",
            "description": "Full description here",
            "cpv_codes": ["72000000"],
            "certifications": ["ISO 27001", "SOC 2"],
        },
    )
    offering_id = create_response.json()["id"]

    # Get details
    response = await client.get(
        f"/api/v1/federations/catalog-test/offerings/{offering_id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Detail Test Offering"
    assert data["certifications"] == ["ISO 27001", "SOC 2"]
    assert data["view_count"] == 1  # View count incremented


@pytest.mark.asyncio
async def test_update_offering(client: AsyncClient, federation_with_provider):
    """Test updating an offering."""
    federation, provider = federation_with_provider

    # Create offering
    create_response = await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Update Test",
        },
    )
    offering_id = create_response.json()["id"]

    # Update offering
    response = await client.patch(
        f"/api/v1/federations/catalog-test/offerings/{offering_id}",
        json={
            "name": "Updated Offering Name",
            "description": "Added description",
            "featured": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Offering Name"
    assert data["featured"] is True


@pytest.mark.asyncio
async def test_delete_offering(client: AsyncClient, federation_with_provider):
    """Test deleting an offering."""
    federation, provider = federation_with_provider

    # Create offering
    create_response = await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Delete Test",
        },
    )
    offering_id = create_response.json()["id"]

    # Delete offering
    response = await client.delete(
        f"/api/v1/federations/catalog-test/offerings/{offering_id}"
    )
    assert response.status_code == 204

    # Verify deleted
    response = await client.get(
        f"/api/v1/federations/catalog-test/offerings/{offering_id}"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_compare_offerings(client: AsyncClient, federation_with_provider):
    """Test comparing two offerings."""
    federation, provider = federation_with_provider

    # Create two offerings
    resp1 = await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Offering A",
            "pricing_model": "free",
            "trl": 9,
        },
    )
    resp2 = await client.post(
        "/api/v1/federations/catalog-test/offerings/",
        json={
            "provider_id": provider["id"],
            "name": "Offering B",
            "pricing_model": "subscription",
            "trl": 7,
        },
    )

    id1 = resp1.json()["id"]
    id2 = resp2.json()["id"]

    # Compare
    response = await client.get(
        f"/api/v1/federations/catalog-test/offerings/{id1}/compare/{id2}"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["offerings"]) == 2
    assert "comparison_fields" in data
