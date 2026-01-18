"""Federation management API endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.federation import (
    Federation,
    FederationCreate,
    FederationPublic,
    FederationStatus,
    FederationUpdate,
)

router = APIRouter()


@router.post(
    "/",
    response_model=FederationPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new federation",
)
async def create_federation(
    federation_in: FederationCreate,
    session: AsyncSession = Depends(get_session),
) -> Federation:
    """Create a new federation for coordinating Waldur instances."""
    # Check if slug already exists
    existing = await session.execute(
        select(Federation).where(Federation.slug == federation_in.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Federation with slug '{federation_in.slug}' already exists",
        )

    federation = Federation(**federation_in.model_dump())
    session.add(federation)
    await session.commit()
    await session.refresh(federation)
    return federation


@router.get(
    "/",
    response_model=list[FederationPublic],
    summary="List all federations",
)
async def list_federations(
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: FederationStatus | None = Query(None, alias="status"),
) -> list[Federation]:
    """List all federations with optional filtering."""
    query = select(Federation)

    if status_filter:
        query = query.where(Federation.status == status_filter)

    query = query.offset(skip).limit(limit).order_by(Federation.created_at.desc())

    result = await session.execute(query)
    return list(result.scalars().all())


@router.get(
    "/{slug}",
    response_model=FederationPublic,
    summary="Get federation by slug",
)
async def get_federation(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> Federation:
    """Get a specific federation by its slug."""
    result = await session.execute(
        select(Federation).where(Federation.slug == slug)
    )
    federation = result.scalar_one_or_none()

    if not federation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Federation '{slug}' not found",
        )

    return federation


@router.patch(
    "/{slug}",
    response_model=FederationPublic,
    summary="Update federation",
)
async def update_federation(
    slug: str,
    federation_in: FederationUpdate,
    session: AsyncSession = Depends(get_session),
) -> Federation:
    """Update a federation's settings."""
    result = await session.execute(
        select(Federation).where(Federation.slug == slug)
    )
    federation = result.scalar_one_or_none()

    if not federation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Federation '{slug}' not found",
        )

    update_data = federation_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(federation, field, value)

    federation.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(federation)
    return federation


@router.delete(
    "/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive federation",
)
async def archive_federation(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Archive a federation (soft delete)."""
    result = await session.execute(
        select(Federation).where(Federation.slug == slug)
    )
    federation = result.scalar_one_or_none()

    if not federation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Federation '{slug}' not found",
        )

    federation.status = FederationStatus.ARCHIVED
    federation.updated_at = datetime.utcnow()
    await session.commit()


@router.get(
    "/{slug}/stats",
    summary="Get federation statistics",
)
async def get_federation_stats(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get statistics for a federation."""
    result = await session.execute(
        select(Federation).where(Federation.slug == slug)
    )
    federation = result.scalar_one_or_none()

    if not federation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Federation '{slug}' not found",
        )

    from app.models.instance import WaldurInstance, InstanceStatus, ConnectionStatus
    from app.models.connection import FederationConnection, ConnectionState, FederationAlert, AlertStatus

    # Get instance stats
    instance_stats = await session.execute(
        select(
            func.count(WaldurInstance.id).label("total"),
            func.sum(func.cast(WaldurInstance.status == InstanceStatus.ACTIVE, int)).label("active"),
            func.sum(func.cast(WaldurInstance.connection_status == ConnectionStatus.ONLINE, int)).label("online"),
        ).where(WaldurInstance.federation_id == federation.id)
    )
    instance_row = instance_stats.one()

    # Get connection stats
    connection_stats = await session.execute(
        select(
            func.count(FederationConnection.id).label("total"),
            func.sum(func.cast(FederationConnection.state == ConnectionState.ACTIVE, int)).label("active"),
        ).where(FederationConnection.federation_id == federation.id)
    )
    connection_row = connection_stats.one()

    # Get active alerts
    alert_count = await session.execute(
        select(func.count(FederationAlert.id)).where(
            FederationAlert.federation_id == federation.id,
            FederationAlert.status == AlertStatus.ACTIVE,
        )
    )

    return {
        "federation_id": str(federation.id),
        "federation_slug": federation.slug,
        "instances": {
            "total": instance_row.total or 0,
            "active": instance_row.active or 0,
            "online": instance_row.online or 0,
        },
        "connections": {
            "total": connection_row.total or 0,
            "active": connection_row.active or 0,
        },
        "active_alerts": alert_count.scalar() or 0,
    }
