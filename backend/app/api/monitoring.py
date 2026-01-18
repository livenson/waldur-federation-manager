"""Federation monitoring API endpoints for transactions and alerts."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.federation import Federation
from app.models.connection import (
    AlertPublic,
    AlertSeverity,
    AlertStatus,
    FederationAlert,
    FederationTransaction,
    TransactionPublic,
    TransactionStatus,
    TransactionType,
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


# Transaction endpoints


@router.get(
    "/{slug}/transactions",
    response_model=list[TransactionPublic],
    summary="List federation transactions",
)
async def list_transactions(
    slug: str,
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    transaction_type: TransactionType | None = Query(None),
    status_filter: TransactionStatus | None = Query(None, alias="status"),
    source_instance_id: UUID | None = Query(None),
    target_instance_id: UUID | None = Query(None),
    connection_id: UUID | None = Query(None),
) -> list[FederationTransaction]:
    """List all transactions in the federation."""
    federation = await get_federation_by_slug(slug, session)

    query = select(FederationTransaction).where(
        FederationTransaction.federation_id == federation.id
    )

    if transaction_type:
        query = query.where(FederationTransaction.transaction_type == transaction_type)

    if status_filter:
        query = query.where(FederationTransaction.status == status_filter)

    if source_instance_id:
        query = query.where(FederationTransaction.source_instance_id == source_instance_id)

    if target_instance_id:
        query = query.where(FederationTransaction.target_instance_id == target_instance_id)

    if connection_id:
        query = query.where(FederationTransaction.connection_id == connection_id)

    query = query.offset(skip).limit(limit).order_by(FederationTransaction.created_at.desc())

    result = await session.execute(query)
    return list(result.scalars().all())


@router.get(
    "/{slug}/transactions/{transaction_id}",
    response_model=TransactionPublic,
    summary="Get transaction details",
)
async def get_transaction(
    slug: str,
    transaction_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> FederationTransaction:
    """Get details of a specific transaction."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationTransaction).where(
            FederationTransaction.id == transaction_id,
            FederationTransaction.federation_id == federation.id,
        )
    )
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction '{transaction_id}' not found",
        )

    return transaction


@router.get(
    "/{slug}/transactions/stats",
    summary="Get transaction statistics",
)
async def get_transaction_stats(
    slug: str,
    session: AsyncSession = Depends(get_session),
    hours: int = Query(24, ge=1, le=720, description="Time window in hours"),
) -> dict:
    """Get transaction statistics for the federation."""
    federation = await get_federation_by_slug(slug, session)

    from datetime import timedelta

    time_threshold = datetime.utcnow() - timedelta(hours=hours)

    # Get counts by status
    status_counts = await session.execute(
        select(
            FederationTransaction.status,
            func.count(FederationTransaction.id).label("count"),
        )
        .where(
            FederationTransaction.federation_id == federation.id,
            FederationTransaction.created_at >= time_threshold,
        )
        .group_by(FederationTransaction.status)
    )

    # Get counts by type
    type_counts = await session.execute(
        select(
            FederationTransaction.transaction_type,
            func.count(FederationTransaction.id).label("count"),
        )
        .where(
            FederationTransaction.federation_id == federation.id,
            FederationTransaction.created_at >= time_threshold,
        )
        .group_by(FederationTransaction.transaction_type)
    )

    # Get average duration for completed transactions
    avg_duration = await session.execute(
        select(func.avg(FederationTransaction.duration_ms))
        .where(
            FederationTransaction.federation_id == federation.id,
            FederationTransaction.status == TransactionStatus.COMPLETED,
            FederationTransaction.created_at >= time_threshold,
            FederationTransaction.duration_ms.is_not(None),
        )
    )

    # Get failed transaction count
    failed_count = await session.execute(
        select(func.count(FederationTransaction.id))
        .where(
            FederationTransaction.federation_id == federation.id,
            FederationTransaction.status == TransactionStatus.FAILED,
            FederationTransaction.created_at >= time_threshold,
        )
    )

    return {
        "time_window_hours": hours,
        "by_status": {row.status.value: row.count for row in status_counts.all()},
        "by_type": {row.transaction_type.value: row.count for row in type_counts.all()},
        "average_duration_ms": avg_duration.scalar() or 0,
        "failed_count": failed_count.scalar() or 0,
    }


# Alert endpoints


@router.get(
    "/{slug}/alerts",
    response_model=list[AlertPublic],
    summary="List federation alerts",
)
async def list_alerts(
    slug: str,
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    severity: AlertSeverity | None = Query(None),
    status_filter: AlertStatus | None = Query(None, alias="status"),
    instance_id: UUID | None = Query(None),
    connection_id: UUID | None = Query(None),
) -> list[FederationAlert]:
    """List all alerts in the federation."""
    federation = await get_federation_by_slug(slug, session)

    query = select(FederationAlert).where(
        FederationAlert.federation_id == federation.id
    )

    if severity:
        query = query.where(FederationAlert.severity == severity)

    if status_filter:
        query = query.where(FederationAlert.status == status_filter)

    if instance_id:
        query = query.where(FederationAlert.instance_id == instance_id)

    if connection_id:
        query = query.where(FederationAlert.connection_id == connection_id)

    query = query.offset(skip).limit(limit).order_by(FederationAlert.created_at.desc())

    result = await session.execute(query)
    return list(result.scalars().all())


@router.get(
    "/{slug}/alerts/active",
    response_model=list[AlertPublic],
    summary="List active alerts",
)
async def list_active_alerts(
    slug: str,
    session: AsyncSession = Depends(get_session),
    severity: AlertSeverity | None = Query(None),
) -> list[FederationAlert]:
    """List all active (unresolved) alerts in the federation."""
    federation = await get_federation_by_slug(slug, session)

    query = select(FederationAlert).where(
        FederationAlert.federation_id == federation.id,
        FederationAlert.status == AlertStatus.ACTIVE,
    )

    if severity:
        query = query.where(FederationAlert.severity == severity)

    query = query.order_by(
        FederationAlert.severity.desc(),
        FederationAlert.created_at.desc(),
    )

    result = await session.execute(query)
    return list(result.scalars().all())


@router.get(
    "/{slug}/alerts/{alert_id}",
    response_model=AlertPublic,
    summary="Get alert details",
)
async def get_alert(
    slug: str,
    alert_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> FederationAlert:
    """Get details of a specific alert."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationAlert).where(
            FederationAlert.id == alert_id,
            FederationAlert.federation_id == federation.id,
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found",
        )

    return alert


@router.post(
    "/{slug}/alerts/{alert_id}/acknowledge",
    response_model=AlertPublic,
    summary="Acknowledge alert",
)
async def acknowledge_alert(
    slug: str,
    alert_id: UUID,
    acknowledged_by: UUID | None = Query(None, description="User ID acknowledging the alert"),
    session: AsyncSession = Depends(get_session),
) -> FederationAlert:
    """Acknowledge an active alert."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationAlert).where(
            FederationAlert.id == alert_id,
            FederationAlert.federation_id == federation.id,
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found",
        )

    if alert.status != AlertStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot acknowledge alert in status '{alert.status}'",
        )

    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledged_by = acknowledged_by

    await session.commit()
    await session.refresh(alert)
    return alert


@router.post(
    "/{slug}/alerts/{alert_id}/resolve",
    response_model=AlertPublic,
    summary="Resolve alert",
)
async def resolve_alert(
    slug: str,
    alert_id: UUID,
    resolved_by: UUID | None = Query(None, description="User ID resolving the alert"),
    session: AsyncSession = Depends(get_session),
) -> FederationAlert:
    """Resolve an alert."""
    federation = await get_federation_by_slug(slug, session)

    result = await session.execute(
        select(FederationAlert).where(
            FederationAlert.id == alert_id,
            FederationAlert.federation_id == federation.id,
        )
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found",
        )

    if alert.status == AlertStatus.RESOLVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alert is already resolved",
        )

    alert.status = AlertStatus.RESOLVED
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = resolved_by

    await session.commit()
    await session.refresh(alert)
    return alert


@router.get(
    "/{slug}/alerts/stats",
    summary="Get alert statistics",
)
async def get_alert_stats(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get alert statistics for the federation."""
    federation = await get_federation_by_slug(slug, session)

    # Get counts by status
    status_counts = await session.execute(
        select(
            FederationAlert.status,
            func.count(FederationAlert.id).label("count"),
        )
        .where(FederationAlert.federation_id == federation.id)
        .group_by(FederationAlert.status)
    )

    # Get counts by severity for active alerts
    severity_counts = await session.execute(
        select(
            FederationAlert.severity,
            func.count(FederationAlert.id).label("count"),
        )
        .where(
            FederationAlert.federation_id == federation.id,
            FederationAlert.status == AlertStatus.ACTIVE,
        )
        .group_by(FederationAlert.severity)
    )

    # Get counts by alert type for active alerts
    type_counts = await session.execute(
        select(
            FederationAlert.alert_type,
            func.count(FederationAlert.id).label("count"),
        )
        .where(
            FederationAlert.federation_id == federation.id,
            FederationAlert.status == AlertStatus.ACTIVE,
        )
        .group_by(FederationAlert.alert_type)
    )

    return {
        "by_status": {row.status.value: row.count for row in status_counts.all()},
        "active_by_severity": {row.severity.value: row.count for row in severity_counts.all()},
        "active_by_type": {row.alert_type: row.count for row in type_counts.all()},
    }


# Dashboard/overview endpoint


@router.get(
    "/{slug}/dashboard",
    summary="Get federation monitoring dashboard",
)
async def get_monitoring_dashboard(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get a comprehensive monitoring dashboard for the federation."""
    federation = await get_federation_by_slug(slug, session)

    from datetime import timedelta
    from app.models.instance import WaldurInstance, InstanceStatus, ConnectionStatus
    from app.models.connection import FederationConnection, ConnectionState

    time_24h = datetime.utcnow() - timedelta(hours=24)

    # Instance stats
    instance_stats = await session.execute(
        select(
            func.count(WaldurInstance.id).label("total"),
            func.sum(func.cast(WaldurInstance.status == InstanceStatus.ACTIVE, int)).label("active"),
            func.sum(func.cast(WaldurInstance.connection_status == ConnectionStatus.ONLINE, int)).label("online"),
            func.sum(func.cast(WaldurInstance.connection_status == ConnectionStatus.OFFLINE, int)).label("offline"),
            func.sum(func.cast(WaldurInstance.connection_status == ConnectionStatus.DEGRADED, int)).label("degraded"),
        ).where(WaldurInstance.federation_id == federation.id)
    )
    instance_row = instance_stats.one()

    # Connection stats
    connection_stats = await session.execute(
        select(
            func.count(FederationConnection.id).label("total"),
            func.sum(func.cast(FederationConnection.state == ConnectionState.ACTIVE, int)).label("active"),
            func.sum(func.cast(FederationConnection.state == ConnectionState.PENDING, int)).label("pending"),
            func.sum(func.cast(FederationConnection.state == ConnectionState.FAILED, int)).label("failed"),
        ).where(FederationConnection.federation_id == federation.id)
    )
    connection_row = connection_stats.one()

    # Transaction stats (last 24h)
    transaction_stats = await session.execute(
        select(
            func.count(FederationTransaction.id).label("total"),
            func.sum(func.cast(FederationTransaction.status == TransactionStatus.COMPLETED, int)).label("completed"),
            func.sum(func.cast(FederationTransaction.status == TransactionStatus.FAILED, int)).label("failed"),
            func.sum(func.cast(FederationTransaction.status == TransactionStatus.IN_PROGRESS, int)).label("in_progress"),
        ).where(
            FederationTransaction.federation_id == federation.id,
            FederationTransaction.created_at >= time_24h,
        )
    )
    transaction_row = transaction_stats.one()

    # Active alerts by severity
    alert_stats = await session.execute(
        select(
            FederationAlert.severity,
            func.count(FederationAlert.id).label("count"),
        )
        .where(
            FederationAlert.federation_id == federation.id,
            FederationAlert.status == AlertStatus.ACTIVE,
        )
        .group_by(FederationAlert.severity)
    )

    return {
        "federation": {
            "id": str(federation.id),
            "name": federation.name,
            "slug": federation.slug,
            "status": federation.status.value,
        },
        "instances": {
            "total": instance_row.total or 0,
            "active": instance_row.active or 0,
            "online": instance_row.online or 0,
            "offline": instance_row.offline or 0,
            "degraded": instance_row.degraded or 0,
        },
        "connections": {
            "total": connection_row.total or 0,
            "active": connection_row.active or 0,
            "pending": connection_row.pending or 0,
            "failed": connection_row.failed or 0,
        },
        "transactions_24h": {
            "total": transaction_row.total or 0,
            "completed": transaction_row.completed or 0,
            "failed": transaction_row.failed or 0,
            "in_progress": transaction_row.in_progress or 0,
        },
        "active_alerts": {
            row.severity.value: row.count for row in alert_stats.all()
        },
    }
