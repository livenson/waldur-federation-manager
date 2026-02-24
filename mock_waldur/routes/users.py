"""User inspection endpoints — view mock users created by Identity Bridge pushes."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mock_waldur.database import get_session
from mock_waldur.models import MockUser

router = APIRouter(prefix="/api/users", tags=["Users"])


class UserResponse(BaseModel):
    id: str
    username: str
    first_name: str
    last_name: str
    email: str
    organization: str
    affiliations: list[str]
    country: str
    phone_number: str
    is_active: bool
    active_isds: list[str]
    created_at: str
    updated_at: str


class IdentityStatusResponse(BaseModel):
    id: str
    username: str
    is_active: bool
    active_isds: list[str]
    attribute_sources: dict
    attributes: dict


def _to_response(user: MockUser) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        organization=user.organization,
        affiliations=json.loads(user.affiliations) if user.affiliations and user.affiliations != "[]" else [],
        country=user.country,
        phone_number=user.phone_number,
        is_active=user.is_active,
        active_isds=json.loads(user.active_isds) if user.active_isds and user.active_isds != "[]" else [],
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
    )


@router.get("/", response_model=list[UserResponse])
async def list_users(
    is_active: bool | None = None,
    isd_source: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[UserResponse]:
    """List mock users with optional filters."""
    query = select(MockUser)
    if is_active is not None:
        query = query.where(MockUser.is_active == is_active)
    query = query.offset(skip).limit(limit).order_by(MockUser.created_at.desc())

    result = await session.execute(query)
    users = result.scalars().all()

    # Filter by ISD source in Python (JSON field)
    if isd_source:
        filtered = []
        for u in users:
            active = json.loads(u.active_isds) if u.active_isds and u.active_isds != "[]" else []
            if isd_source in active:
                filtered.append(u)
        users = filtered

    return [_to_response(u) for u in users]


@router.get("/{user_uuid}", response_model=UserResponse)
async def get_user(
    user_uuid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Get a user by ID."""
    result = await session.execute(select(MockUser).where(MockUser.id == user_uuid))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_response(user)


@router.get("/{user_uuid}/identity-status", response_model=IdentityStatusResponse)
async def get_identity_status(
    user_uuid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> IdentityStatusResponse:
    """Get detailed identity status — attribute sources and ISD breakdown."""
    result = await session.execute(select(MockUser).where(MockUser.id == user_uuid))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    attribute_sources = json.loads(user.attribute_sources) if user.attribute_sources and user.attribute_sources != "{}" else {}
    active_isds = json.loads(user.active_isds) if user.active_isds and user.active_isds != "[]" else []
    affiliations = json.loads(user.affiliations) if user.affiliations and user.affiliations != "[]" else []

    return IdentityStatusResponse(
        id=str(user.id),
        username=user.username,
        is_active=user.is_active,
        active_isds=active_isds,
        attribute_sources=attribute_sources,
        attributes={
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "organization": user.organization,
            "affiliations": affiliations,
            "country": user.country,
            "phone_number": user.phone_number,
        },
    )
