"""Attribute policy enforcement using OIDC Federation metadata_policy operators."""

import json
import logging
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from mock_waldur.config import get_settings
from mock_waldur.federation_auth import _decode_payload_unverified
from mock_waldur.models import FederationEntity

logger = logging.getLogger(__name__)

# Attributes that can be pushed via Identity Bridge
IDENTITY_BRIDGE_ATTRIBUTES = {
    "username",
    "first_name",
    "last_name",
    "email",
    "organization",
    "affiliations",
    "country",
    "phone_number",
}


def resolve_allowed_attributes(
    metadata_policy: dict,
) -> tuple[set[str], set[str], dict]:
    """Parse OIDC Federation metadata_policy into attribute constraints.

    Looks inside the first entity type key (e.g. "federation_entity" or
    "identity_bridge") for claim-level operators.

    Returns:
        (allowed_fields, required_fields, constraints)
        - allowed_fields: set of attribute names mentioned in the policy
        - required_fields: attributes with essential=true
        - constraints: {field: {operator: value, ...}}
    """
    allowed_fields: set[str] = set()
    required_fields: set[str] = set()
    constraints: dict[str, dict] = {}

    # Walk entity type keys in the policy
    for _entity_type, type_policy in metadata_policy.items():
        if not isinstance(type_policy, dict):
            continue
        for claim, operators in type_policy.items():
            if not isinstance(operators, dict):
                continue
            # Only consider claims that map to Identity Bridge attributes
            if claim not in IDENTITY_BRIDGE_ATTRIBUTES:
                continue
            allowed_fields.add(claim)
            constraints[claim] = operators
            if operators.get("essential") is True:
                required_fields.add(claim)

    return allowed_fields, required_fields, constraints


def validate_attributes(attributes: dict, metadata_policy: dict) -> list[str]:
    """Validate pushed attributes against metadata policy.

    Returns a list of violation description strings (empty = valid).
    """
    if not metadata_policy:
        return []

    _allowed, required_fields, constraints = resolve_allowed_attributes(metadata_policy)
    violations: list[str] = []

    # Check required fields
    for field in required_fields:
        val = attributes.get(field)
        if val is None or val == "" or val == []:
            violations.append(f"Required attribute '{field}' is missing or empty")

    # Check constraints on provided attributes
    for field, operators in constraints.items():
        val = attributes.get(field)
        if val is None:
            continue

        # value operator: anchor override — entity cannot change it
        if "value" in operators:
            # The pushed value is ignored; anchor value will be used
            continue

        # one_of
        if "one_of" in operators:
            allowed = operators["one_of"]
            if not isinstance(allowed, list):
                allowed = [allowed]
            if val not in allowed:
                violations.append(
                    f"Attribute '{field}' value {val!r} not in allowed set {allowed}"
                )

        # subset_of
        if "subset_of" in operators:
            allowed_set = set(operators["subset_of"])
            val_set = set(val) if isinstance(val, list) else {val}
            if not val_set.issubset(allowed_set):
                extra = val_set - allowed_set
                violations.append(
                    f"Attribute '{field}' contains disallowed values: {extra}"
                )

        # superset_of
        if "superset_of" in operators:
            required_set = set(operators["superset_of"])
            val_set = set(val) if isinstance(val, list) else {val}
            if not val_set.issuperset(required_set):
                missing = required_set - val_set
                violations.append(
                    f"Attribute '{field}' missing required values: {missing}"
                )

    return violations


async def refresh_metadata_policy(
    entity: FederationEntity, session: AsyncSession
) -> dict:
    """Fetch subordinate statement from Trust Anchor and extract metadata_policy."""
    settings = get_settings()
    anchor_url = entity.trust_anchor_url or settings.default_trust_anchor_url
    fetch_url = f"{anchor_url.rstrip('/')}/federation/fetch"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(fetch_url, params={"sub": entity.entity_id})
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Failed to fetch subordinate statement for %s: %s", entity.entity_id, exc)
        return {}

    token = resp.text.strip()
    try:
        payload = _decode_payload_unverified(token)
    except Exception as exc:
        logger.warning("Failed to decode subordinate statement JWT: %s", exc)
        return {}

    policy = payload.get("metadata_policy", {})

    entity.metadata_policy = json.dumps(policy)
    entity.policy_updated_at = datetime.utcnow()
    entity.updated_at = datetime.utcnow()
    session.add(entity)
    await session.commit()
    await session.refresh(entity)

    logger.info("Refreshed metadata policy for %s", entity.entity_id)
    return policy
