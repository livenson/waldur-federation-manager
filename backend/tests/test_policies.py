"""Tests for metadata policy management and policy engine."""

import pytest
from httpx import AsyncClient

from app.federation.metadata_policy import apply_policy, apply_policy_to_value, merge_policies
from app.exceptions import MetadataPolicyError


# --- Policy Engine Unit Tests ---


def test_value_operator():
    result = apply_policy_to_value("old", {"value": "new"})
    assert result == "new"


def test_add_operator():
    result = apply_policy_to_value(["a"], {"add": ["b", "c"]})
    assert result == ["a", "b", "c"]


def test_add_operator_no_duplicates():
    result = apply_policy_to_value(["a", "b"], {"add": ["b", "c"]})
    assert result == ["a", "b", "c"]


def test_default_operator_sets_missing():
    result = apply_policy_to_value(None, {"default": "fallback"})
    assert result == "fallback"


def test_default_operator_no_override():
    result = apply_policy_to_value("existing", {"default": "fallback"})
    assert result == "existing"


def test_one_of_valid():
    result = apply_policy_to_value("a", {"one_of": ["a", "b", "c"]})
    assert result == "a"


def test_one_of_invalid():
    with pytest.raises(MetadataPolicyError):
        apply_policy_to_value("d", {"one_of": ["a", "b", "c"]})


def test_subset_of_valid():
    result = apply_policy_to_value(["a", "b"], {"subset_of": ["a", "b", "c"]})
    assert result == ["a", "b"]


def test_subset_of_invalid():
    with pytest.raises(MetadataPolicyError):
        apply_policy_to_value(["a", "d"], {"subset_of": ["a", "b", "c"]})


def test_superset_of_valid():
    result = apply_policy_to_value(["a", "b", "c"], {"superset_of": ["a", "b"]})
    assert result == ["a", "b", "c"]


def test_superset_of_invalid():
    with pytest.raises(MetadataPolicyError):
        apply_policy_to_value(["a"], {"superset_of": ["a", "b"]})


def test_essential_present():
    result = apply_policy_to_value("value", {"essential": True})
    assert result == "value"


def test_essential_missing():
    with pytest.raises(MetadataPolicyError):
        apply_policy_to_value(None, {"essential": True})


def test_essential_empty():
    with pytest.raises(MetadataPolicyError):
        apply_policy_to_value("", {"essential": True})


def test_combined_operators():
    """Test operators applied in spec order: add, then default, then subset_of."""
    result = apply_policy_to_value(
        None,
        {"default": ["a"], "add": ["b"], "subset_of": ["a", "b", "c"]},
    )
    # Order: add(None, ["b"]) → ["b"], default(["b"], ["a"]) → ["b"] (not None), subset_of OK
    assert set(result) <= {"a", "b", "c"}


def test_apply_policy():
    metadata = {
        "openid_relying_party": {
            "grant_types": ["authorization_code"],
            "contacts": ["admin@example.com"],
        }
    }
    policy = {
        "openid_relying_party": {
            "grant_types": {"subset_of": ["authorization_code", "implicit"]},
            "token_endpoint_auth_method": {"default": "client_secret_basic"},
        }
    }
    result = apply_policy(metadata, policy)
    rp = result["openid_relying_party"]
    assert rp["grant_types"] == ["authorization_code"]
    assert rp["token_endpoint_auth_method"] == "client_secret_basic"
    assert rp["contacts"] == ["admin@example.com"]


def test_merge_policies():
    upper = {
        "openid_relying_party": {
            "grant_types": {"value": ["authorization_code"]},
        }
    }
    lower = {
        "openid_relying_party": {
            "grant_types": {"subset_of": ["authorization_code", "implicit"]},
            "contacts": {"essential": True},
        }
    }
    merged = merge_policies(upper, lower)
    rp = merged["openid_relying_party"]
    # Upper overrides lower for same claim/operator
    assert rp["grant_types"]["value"] == ["authorization_code"]
    # Lower's subset_of is still present (merged)
    assert rp["grant_types"]["subset_of"] == ["authorization_code", "implicit"]
    assert rp["contacts"]["essential"] is True


# --- Policy Management API Tests ---


@pytest.mark.asyncio
async def test_create_policy(client: AsyncClient):
    resp = await client.post(
        "/api/policies/",
        json={
            "name": "RP Strict",
            "entity_type": "openid_relying_party",
            "policy": {
                "openid_relying_party": {
                    "grant_types": {"subset_of": ["authorization_code"]},
                }
            },
        },
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "RP Strict"


@pytest.mark.asyncio
async def test_list_policies(client: AsyncClient):
    await client.post(
        "/api/policies/",
        json={"name": "P1", "entity_type": "openid_relying_party", "policy": {}},
    )
    resp = await client.get("/api/policies/")
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_update_policy(client: AsyncClient):
    create_resp = await client.post(
        "/api/policies/",
        json={"name": "Update Me", "entity_type": "openid_provider", "policy": {}},
    )
    policy_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/policies/{policy_id}",
        json={"description": "Updated description"},
    )
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated description"


@pytest.mark.asyncio
async def test_delete_policy(client: AsyncClient):
    create_resp = await client.post(
        "/api/policies/",
        json={"name": "Delete Me", "entity_type": "openid_provider", "policy": {}},
    )
    policy_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/policies/{policy_id}")
    assert resp.status_code == 204
