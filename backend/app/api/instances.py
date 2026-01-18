"""Waldur instance management API endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.federation import Federation
from app.models.instance import (
    ConnectionStatus,
    InstanceCreate,
    InstanceDiscovery,
    InstancePublic,
    InstanceStatus,
    InstanceUpdate,
    WaldurInstance,
)

router = APIRouter()


async def get_federation_by_slug(
    slug: str, session: AsyncSession
) -> Federation:
    """Get federation by slug or raise 404."""
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


@router.post(
    "/{slug}/instances",
    response_model=InstancePublic,
    status_code=status.HTTP_201_CREATED,
    summary="Register a Waldur instance",
)
async def register_instance(
    slug: str,
    instance_in: InstanceCreate,
    session: AsyncSession = Depends(get_session),
) -> WaldurInstance:
    """Register a new Waldur instance with the federation."""
    federation = await get_federation_by_slug(slug, session)

    # Check if instance with same API URL already exists
    existing = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.federation_id == federation.id,
            WaldurInstance.api_url == instance_in.api_url,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Instance with API URL '{instance_in.api_url}' already registered",
        )

    # Set initial status based on federation settings
    initial_status = (
        InstanceStatus.PENDING
        if federation.require_approval
        else InstanceStatus.ACTIVE
    )

    # Handle ToS acceptance
    tos_accepted_at = None
    tos_accepted_version = None
    if instance_in.tos_accepted and federation.require_tos_acceptance:
        if not federation.tos_version:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Federation has no ToS version configured",
            )
        tos_accepted_at = datetime.utcnow()
        tos_accepted_version = federation.tos_version

    instance = WaldurInstance(
        **instance_in.model_dump(exclude={"tos_accepted"}),
        federation_id=federation.id,
        status=initial_status,
        tos_accepted=instance_in.tos_accepted,
        tos_accepted_at=tos_accepted_at,
        tos_accepted_version=tos_accepted_version,
        approved_at=datetime.utcnow() if initial_status == InstanceStatus.ACTIVE else None,
    )

    session.add(instance)

    # Update federation instance count
    federation.instance_count += 1
    federation.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(instance)
    return instance


@router.get(
    "/{slug}/instances",
    response_model=list[InstancePublic],
    summary="List registered instances",
)
async def list_instances(
    slug: str,
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: InstanceStatus | None = Query(None, alias="status"),
    connection_status: ConnectionStatus | None = Query(None),
) -> list[WaldurInstance]:
    """List all Waldur instances registered with the federation."""
    federation = await get_federation_by_slug(slug, session)

    query = select(WaldurInstance).where(
        WaldurInstance.federation_id == federation.id
    )

    if status_filter:
        query = query.where(WaldurInstance.status == status_filter)

    if connection_status:
        query = query.where(WaldurInstance.connection_status == connection_status)

    query = query.offset(skip).limit(limit).order_by(WaldurInstance.registered_at.desc())

    result = await session.execute(query)
    return list(result.scalars().all())


@router.get(
    "/{slug}/instances/discover",
    response_model=list[InstanceDiscovery],
    summary="Discover available instances",
)
async def discover_instances(
    slug: str,
    session: AsyncSession = Depends(get_session),
    capability: str | None = Query(None, description="Filter by capability"),
    country: str | None = Query(None, description="Filter by country code"),
) -> list[WaldurInstance]:
    """Discover active instances for potential federation connections."""
    federation = await get_federation_by_slug(slug, session)

    if not federation.public_discovery:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public discovery is disabled for this federation",
        )

    query = select(WaldurInstance).where(
        WaldurInstance.federation_id == federation.id,
        WaldurInstance.status == InstanceStatus.ACTIVE,
    )

    if country:
        query = query.where(WaldurInstance.country == country.upper())

    result = await session.execute(query)
    instances = list(result.scalars().all())

    # Filter by capability if specified
    if capability:
        instances = [i for i in instances if capability in i.capabilities]

    return instances


@router.get(
    "/{slug}/instances/{instance_id}",
    response_model=InstancePublic,
    summary="Get instance details",
)
async def get_instance(
    slug: str,
    instance_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> WaldurInstance:
    """Get details of a specific Waldur instance."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.id == instance_id,
            WaldurInstance.federation_id == federation.id,
        )
    )
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found",
        )

    return instance


@router.patch(
    "/{slug}/instances/{instance_id}",
    response_model=InstancePublic,
    summary="Update instance",
)
async def update_instance(
    slug: str,
    instance_id: UUID,
    instance_in: InstanceUpdate,
    session: AsyncSession = Depends(get_session),
) -> WaldurInstance:
    """Update a Waldur instance's information."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.id == instance_id,
            WaldurInstance.federation_id == federation.id,
        )
    )
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found",
        )

    update_data = instance_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(instance, field, value)

    instance.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(instance)
    return instance


@router.post(
    "/{slug}/instances/{instance_id}/approve",
    response_model=InstancePublic,
    summary="Approve instance registration",
)
async def approve_instance(
    slug: str,
    instance_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> WaldurInstance:
    """Approve a pending instance registration."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.id == instance_id,
            WaldurInstance.federation_id == federation.id,
        )
    )
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found",
        )

    if instance.status != InstanceStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Instance is not pending approval (current status: {instance.status})",
        )

    # Check ToS acceptance if required
    if federation.require_tos_acceptance and not instance.tos_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instance must accept Terms of Service before approval",
        )

    instance.status = InstanceStatus.ACTIVE
    instance.approved_at = datetime.utcnow()
    instance.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(instance)
    return instance


@router.post(
    "/{slug}/instances/{instance_id}/reject",
    response_model=InstancePublic,
    summary="Reject instance registration",
)
async def reject_instance(
    slug: str,
    instance_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> WaldurInstance:
    """Reject a pending instance registration."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.id == instance_id,
            WaldurInstance.federation_id == federation.id,
        )
    )
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found",
        )

    if instance.status != InstanceStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Instance is not pending approval (current status: {instance.status})",
        )

    instance.status = InstanceStatus.REJECTED
    instance.updated_at = datetime.utcnow()

    # Decrement federation instance count
    federation.instance_count = max(0, federation.instance_count - 1)
    federation.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(instance)
    return instance


@router.post(
    "/{slug}/instances/{instance_id}/suspend",
    response_model=InstancePublic,
    summary="Suspend instance",
)
async def suspend_instance(
    slug: str,
    instance_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> WaldurInstance:
    """Suspend an active instance."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.id == instance_id,
            WaldurInstance.federation_id == federation.id,
        )
    )
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found",
        )

    if instance.status != InstanceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only active instances can be suspended (current status: {instance.status})",
        )

    instance.status = InstanceStatus.SUSPENDED
    instance.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(instance)
    return instance


@router.post(
    "/{slug}/instances/{instance_id}/accept-tos",
    response_model=InstancePublic,
    summary="Accept Terms of Service",
)
async def accept_tos(
    slug: str,
    instance_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> WaldurInstance:
    """Accept the federation's Terms of Service."""
    federation = await get_federation_by_slug(slug, session)

    if not federation.tos_url or not federation.tos_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Federation has no Terms of Service configured",
        )

    result = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.id == instance_id,
            WaldurInstance.federation_id == federation.id,
        )
    )
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found",
        )

    instance.tos_accepted = True
    instance.tos_accepted_at = datetime.utcnow()
    instance.tos_accepted_version = federation.tos_version
    instance.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(instance)
    return instance


@router.delete(
    "/{slug}/instances/{instance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove instance",
)
async def remove_instance(
    slug: str,
    instance_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Remove a Waldur instance from the federation."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.id == instance_id,
            WaldurInstance.federation_id == federation.id,
        )
    )
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found",
        )

    await session.delete(instance)

    # Update federation instance count
    federation.instance_count = max(0, federation.instance_count - 1)
    federation.updated_at = datetime.utcnow()

    await session.commit()
