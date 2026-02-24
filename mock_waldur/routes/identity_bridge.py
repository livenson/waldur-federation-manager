"""Identity Bridge endpoints — receive user attribute pushes from federated ISDs."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mock_waldur.config import get_settings
from mock_waldur.database import get_session
from mock_waldur.federation_auth import FederationAuthError, verify_federation_jwt
from mock_waldur.models import FederationEntity, MockUser
from mock_waldur.policy_engine import refresh_metadata_policy, validate_attributes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/identity-bridge", tags=["Identity Bridge"])


class IdentityPush(BaseModel):
    username: str
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    organization: str = ""
    affiliations: list[str] = []
    country: str = ""
    phone_number: str = ""


class IdentityRemove(BaseModel):
    username: str


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return authorization[7:]


@router.post("/")
async def push_identity(
    data: IdentityPush,
    authorization: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Receive user attributes from a federated ISD.

    1. Verify federation JWT
    2. Look up FederationEntity mapping
    3. Validate attributes against metadata policy
    4. Create/update user with source-aware attribute tracking
    """
    settings = get_settings()

    # 1. Verify JWT
    token = _extract_bearer_token(authorization)
    try:
        entity_id, claims = await verify_federation_jwt(token, session)
    except FederationAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # 2. Look up mapping
    result = await session.execute(
        select(FederationEntity).where(
            FederationEntity.entity_id == entity_id,
            FederationEntity.is_active == True,  # noqa: E712
        )
    )
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=403, detail=f"No active mapping for entity: {entity_id}")

    isd_source = entity.isd_source

    # 3. Check metadata policy
    policy = json.loads(entity.metadata_policy) if entity.metadata_policy and entity.metadata_policy != "{}" else {}

    # Refresh policy if not cached or stale
    if not policy:
        cache_age = None
        if entity.policy_updated_at:
            cache_age = (datetime.utcnow() - entity.policy_updated_at).total_seconds()
        if cache_age is None or cache_age > settings.policy_cache_ttl_seconds:
            policy = await refresh_metadata_policy(entity, session)

    if policy:
        attributes = data.model_dump(exclude={"username"})
        violations = validate_attributes(attributes, policy)
        if violations:
            raise HTTPException(
                status_code=422,
                detail={"message": "Attribute policy violations", "violations": violations},
            )

    # 4. Create or update user
    user_result = await session.execute(
        select(MockUser).where(MockUser.username == data.username)
    )
    user = user_result.scalars().first()
    created = user is None

    if not user:
        user = MockUser(username=data.username)
        session.add(user)
        await session.commit()
        await session.refresh(user)

    # Source-aware attribute update
    attribute_sources = json.loads(user.attribute_sources) if user.attribute_sources and user.attribute_sources != "{}" else {}
    now_iso = datetime.utcnow().isoformat()
    updated_fields: list[str] = []

    pushable_fields = ["first_name", "last_name", "email", "organization", "country", "phone_number"]
    push_data = data.model_dump()

    for field in pushable_fields:
        new_value = push_data.get(field, "")

        # Preserve-other-sources: if the pushed value is empty and
        # the field is owned by a different ISD, skip it
        if not new_value:
            existing_source = attribute_sources.get(field, {})
            if isinstance(existing_source, dict) and existing_source.get("source") and existing_source["source"] != isd_source:
                continue

        current_value = getattr(user, field, "")
        if new_value != current_value:
            setattr(user, field, new_value)
            updated_fields.append(field)

        if new_value:
            attribute_sources[field] = {"source": isd_source, "timestamp": now_iso}

    # Handle affiliations (list field)
    new_affiliations = push_data.get("affiliations", [])
    current_affiliations = json.loads(user.affiliations) if user.affiliations and user.affiliations != "[]" else []
    if new_affiliations != current_affiliations:
        user.affiliations = json.dumps(new_affiliations)
        updated_fields.append("affiliations")
    if new_affiliations:
        attribute_sources["affiliations"] = {"source": isd_source, "timestamp": now_iso}

    # Update active ISDs
    active_isds = json.loads(user.active_isds) if user.active_isds and user.active_isds != "[]" else []
    if isd_source not in active_isds:
        active_isds.append(isd_source)
    user.active_isds = json.dumps(active_isds)

    user.attribute_sources = json.dumps(attribute_sources)
    user.is_active = True
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return {
        "id": str(user.id),
        "username": user.username,
        "created": created,
        "updated_fields": updated_fields,
        "isd_source": isd_source,
    }


@router.post("/remove/")
async def remove_identity(
    data: IdentityRemove,
    authorization: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Remove an ISD's contribution to a user's identity.

    Clears attributes owned by this ISD and removes it from active_isds.
    Deactivates the user if no active ISDs remain.
    """
    # Auth
    token = _extract_bearer_token(authorization)
    try:
        entity_id, claims = await verify_federation_jwt(token, session)
    except FederationAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # Look up mapping
    result = await session.execute(
        select(FederationEntity).where(
            FederationEntity.entity_id == entity_id,
            FederationEntity.is_active == True,  # noqa: E712
        )
    )
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=403, detail=f"No active mapping for entity: {entity_id}")

    isd_source = entity.isd_source

    # Find user
    user_result = await session.execute(
        select(MockUser).where(MockUser.username == data.username)
    )
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found: {data.username}")

    # Clear attributes owned by this ISD
    attribute_sources = json.loads(user.attribute_sources) if user.attribute_sources and user.attribute_sources != "{}" else {}
    cleared_fields: list[str] = []

    for field, source_info in list(attribute_sources.items()):
        if isinstance(source_info, dict) and source_info.get("source") == isd_source:
            if hasattr(user, field):
                if field == "affiliations":
                    setattr(user, field, "[]")
                else:
                    setattr(user, field, "")
                cleared_fields.append(field)
            del attribute_sources[field]

    # Remove from active_isds
    active_isds = json.loads(user.active_isds) if user.active_isds and user.active_isds != "[]" else []
    if isd_source in active_isds:
        active_isds.remove(isd_source)

    user.active_isds = json.dumps(active_isds)
    user.attribute_sources = json.dumps(attribute_sources)

    # Deactivate if no ISDs remain
    if not active_isds:
        user.is_active = False

    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return {
        "id": str(user.id),
        "username": user.username,
        "isd_source_removed": isd_source,
        "cleared_fields": cleared_fields,
        "is_active": user.is_active,
        "remaining_isds": active_isds,
    }
