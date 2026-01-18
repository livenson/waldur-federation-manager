"""Federation connection management API endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.federation import Federation
from app.models.instance import WaldurInstance, InstanceStatus
from app.models.connection import (
    ConnectionCreate,
    ConnectionPublic,
    ConnectionState,
    ConnectionType,
    FederationConnection,
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


async def validate_instance(
    instance_id: UUID, federation_id: UUID, session: AsyncSession
) -> WaldurInstance:
    """Validate instance exists and is active."""
    result = await session.execute(
        select(WaldurInstance).where(
            WaldurInstance.id == instance_id,
            WaldurInstance.federation_id == federation_id,
        )
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Instance '{instance_id}' not found in federation",
        )
    if instance.status != InstanceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Instance '{instance_id}' is not active (status: {instance.status})",
        )
    return instance


@router.post(
    "/{slug}/connections",
    response_model=ConnectionPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Create federation connection",
)
async def create_connection(
    slug: str,
    connection_in: ConnectionCreate,
    session: AsyncSession = Depends(get_session),
) -> FederationConnection:
    """Create a new connection between two Waldur instances."""
    federation = await get_federation_by_slug(slug, session)

    # Validate both instances
    source = await validate_instance(
        connection_in.source_instance_id, federation.id, session
    )
    target = await validate_instance(
        connection_in.target_instance_id, federation.id, session
    )

    if source.id == target.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target instances must be different",
        )

    # Check for existing connection
    existing = await session.execute(
        select(FederationConnection).where(
            FederationConnection.federation_id == federation.id,
            FederationConnection.source_instance_id == connection_in.source_instance_id,
            FederationConnection.target_instance_id == connection_in.target_instance_id,
            FederationConnection.connection_type == connection_in.connection_type,
            FederationConnection.state.not_in([
                ConnectionState.TERMINATED,
                ConnectionState.FAILED,
            ]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Active connection already exists between these instances",
        )

    connection = FederationConnection(
        federation_id=federation.id,
        source_instance_id=connection_in.source_instance_id,
        target_instance_id=connection_in.target_instance_id,
        connection_type=connection_in.connection_type,
        connection_metadata=connection_in.connection_metadata,
        state=ConnectionState.PENDING,
    )

    session.add(connection)
    await session.commit()
    await session.refresh(connection)
    return connection


@router.get(
    "/{slug}/connections",
    response_model=list[ConnectionPublic],
    summary="List federation connections",
)
async def list_connections(
    slug: str,
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    state: ConnectionState | None = Query(None),
    connection_type: ConnectionType | None = Query(None),
    instance_id: UUID | None = Query(None, description="Filter by source or target instance"),
) -> list[FederationConnection]:
    """List all connections in the federation."""
    federation = await get_federation_by_slug(slug, session)

    query = select(FederationConnection).where(
        FederationConnection.federation_id == federation.id
    )

    if state:
        query = query.where(FederationConnection.state == state)

    if connection_type:
        query = query.where(FederationConnection.connection_type == connection_type)

    if instance_id:
        query = query.where(
            or_(
                FederationConnection.source_instance_id == instance_id,
                FederationConnection.target_instance_id == instance_id,
            )
        )

    query = query.offset(skip).limit(limit).order_by(FederationConnection.created_at.desc())

    result = await session.execute(query)
    return list(result.scalars().all())


@router.get(
    "/{slug}/connections/{connection_id}",
    response_model=ConnectionPublic,
    summary="Get connection details",
)
async def get_connection(
    slug: str,
    connection_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> FederationConnection:
    """Get details of a specific connection."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationConnection).where(
            FederationConnection.id == connection_id,
            FederationConnection.federation_id == federation.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{connection_id}' not found",
        )

    return connection


@router.post(
    "/{slug}/connections/{connection_id}/activate",
    response_model=ConnectionPublic,
    summary="Activate connection",
)
async def activate_connection(
    slug: str,
    connection_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> FederationConnection:
    """Activate a pending or paused connection."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationConnection).where(
            FederationConnection.id == connection_id,
            FederationConnection.federation_id == federation.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{connection_id}' not found",
        )

    if connection.state not in [ConnectionState.PENDING, ConnectionState.PAUSED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate connection in state '{connection.state}'",
        )

    connection.state = ConnectionState.ACTIVE
    connection.established_at = datetime.utcnow()
    connection.last_activity = datetime.utcnow()

    # Update federation active connections count
    federation.active_connections += 1
    federation.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(connection)
    return connection


@router.post(
    "/{slug}/connections/{connection_id}/pause",
    response_model=ConnectionPublic,
    summary="Pause connection",
)
async def pause_connection(
    slug: str,
    connection_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> FederationConnection:
    """Pause an active connection."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationConnection).where(
            FederationConnection.id == connection_id,
            FederationConnection.federation_id == federation.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{connection_id}' not found",
        )

    if connection.state != ConnectionState.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot pause connection in state '{connection.state}'",
        )

    connection.state = ConnectionState.PAUSED
    connection.last_activity = datetime.utcnow()

    # Update federation active connections count
    federation.active_connections = max(0, federation.active_connections - 1)
    federation.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(connection)
    return connection


@router.post(
    "/{slug}/connections/{connection_id}/terminate",
    response_model=ConnectionPublic,
    summary="Terminate connection",
)
async def terminate_connection(
    slug: str,
    connection_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> FederationConnection:
    """Terminate a connection."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationConnection).where(
            FederationConnection.id == connection_id,
            FederationConnection.federation_id == federation.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{connection_id}' not found",
        )

    if connection.state == ConnectionState.TERMINATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connection is already terminated",
        )

    was_active = connection.state == ConnectionState.ACTIVE
    connection.state = ConnectionState.TERMINATED
    connection.terminated_at = datetime.utcnow()

    # Update federation active connections count if was active
    if was_active:
        federation.active_connections = max(0, federation.active_connections - 1)
        federation.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(connection)
    return connection


@router.post(
    "/{slug}/connections/{connection_id}/record-error",
    response_model=ConnectionPublic,
    summary="Record connection error",
)
async def record_connection_error(
    slug: str,
    connection_id: UUID,
    error_message: str = Query(..., max_length=1000),
    session: AsyncSession = Depends(get_session),
) -> FederationConnection:
    """Record an error for a connection."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationConnection).where(
            FederationConnection.id == connection_id,
            FederationConnection.federation_id == federation.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{connection_id}' not found",
        )

    connection.error_message = error_message
    connection.error_count += 1
    connection.last_error_at = datetime.utcnow()

    # Mark as failed if too many errors
    if connection.error_count >= 5 and connection.state == ConnectionState.ACTIVE:
        connection.state = ConnectionState.FAILED
        federation.active_connections = max(0, federation.active_connections - 1)
        federation.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(connection)
    return connection


@router.delete(
    "/{slug}/connections/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete connection",
)
async def delete_connection(
    slug: str,
    connection_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a terminated connection."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationConnection).where(
            FederationConnection.id == connection_id,
            FederationConnection.federation_id == federation.id,
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connection '{connection_id}' not found",
        )

    if connection.state not in [ConnectionState.TERMINATED, ConnectionState.FAILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only terminated or failed connections can be deleted",
        )

    await session.delete(connection)
    await session.commit()
