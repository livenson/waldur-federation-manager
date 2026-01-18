"""Tests for sync service."""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.waldur_client import WaldurClient
from app.services.cpv_service import CPVService


class TestWaldurClient:
    """Tests for Waldur API client."""

    def test_compute_offering_hash(self):
        """Test offering hash computation."""
        offering_data = {
            "name": "Test Offering",
            "description": "A test",
            "full_description": "Full description",
            "terms_of_service": None,
            "category": "compute",
            "state": "Active",
            "attributes": {},
        }

        hash1 = WaldurClient.compute_offering_hash(offering_data)
        assert len(hash1) == 64  # SHA-256 hex

        # Same data should produce same hash
        hash2 = WaldurClient.compute_offering_hash(offering_data)
        assert hash1 == hash2

        # Different data should produce different hash
        offering_data["name"] = "Changed Name"
        hash3 = WaldurClient.compute_offering_hash(offering_data)
        assert hash1 != hash3

    def test_map_offering_to_federation(self):
        """Test mapping Waldur offering to federation format."""
        waldur_offering = {
            "uuid": "123e4567-e89b-12d3-a456-426614174000",
            "name": "HPC Computing",
            "tagline": "High performance computing service for research",
            "description": "Short description",
            "full_description": "Full markdown description",
            "thumbnail": "https://example.com/logo.png",
            "category_title": "Compute",
            "terms_of_service_link": "https://example.com/tos",
            "components": [
                {"billing_type": "usage"},
            ],
            "attributes": {
                "documentation_url": "https://docs.example.com",
                "geographic_availability": ["DE", "FR"],
            },
        }

        client = WaldurClient("https://waldur.example.com")
        result = client.map_offering_to_federation(waldur_offering)

        assert result["source_offering_uuid"] == "123e4567-e89b-12d3-a456-426614174000"
        assert result["name"] == "HPC Computing"
        assert result["tagline"] == "High performance computing service for research"
        assert result["description"] == "Full markdown description"
        assert result["logo_url"] == "https://example.com/logo.png"
        assert result["categories"] == ["Compute"]
        assert result["pricing_model"] == "pay_per_use"
        assert result["documentation_url"] == "https://docs.example.com"
        assert result["geographic_availability"] == ["DE", "FR"]

    def test_map_pricing_model(self):
        """Test pricing model mapping."""
        client = WaldurClient("https://waldur.example.com")

        # Free (no components)
        assert client._map_pricing_model({"components": []}) == "free"

        # Usage-based
        assert client._map_pricing_model({
            "components": [{"billing_type": "usage"}]
        }) == "pay_per_use"

        # Fixed
        assert client._map_pricing_model({
            "components": [{"billing_type": "fixed"}]
        }) == "subscription"

        # Hybrid
        assert client._map_pricing_model({
            "components": [
                {"billing_type": "usage"},
                {"billing_type": "fixed"},
            ]
        }) == "hybrid"


class TestCPVService:
    """Tests for CPV code service."""

    def test_get_cpv_level(self):
        """Test CPV code level detection."""
        service = CPVService()

        # Division level (XX000000)
        assert service.get_cpv_level("72000000") == 1

        # Group level (XXX00000)
        assert service.get_cpv_level("72200000") == 2

        # Class level (XXXX0000)
        assert service.get_cpv_level("72210000") == 3

        # Category level
        assert service.get_cpv_level("72212000") == 4

    def test_get_parent_code(self):
        """Test parent CPV code detection."""
        service = CPVService()

        # Division has no parent
        assert service.get_parent_code("72000000") is None

        # Group parent is division
        assert service.get_parent_code("72200000") == "72000000"

        # Class parent is group
        assert service.get_parent_code("72210000") == "72200000"

        # Category parent is class
        assert service.get_parent_code("72212000") == "72210000"

    def test_suggest_cpv_codes(self):
        """Test CPV code suggestions."""
        service = CPVService()

        # Cloud computing
        suggestions = service.suggest_cpv_codes(
            "Cloud Computing Platform",
            "Scalable cloud computing resources"
        )
        assert "72000000" in suggestions

        # Storage
        suggestions = service.suggest_cpv_codes(
            "Data Storage Service",
            "Secure data storage for research"
        )
        assert "72317000" in suggestions

        # Training
        suggestions = service.suggest_cpv_codes(
            "Training Platform",
            "Online training and courses"
        )
        assert "80000000" in suggestions
