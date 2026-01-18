"""Service for monitoring instance health and managing federation connections."""

import logging
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.federation import Federation
from app.models.instance import WaldurInstance, InstanceStatus, ConnectionStatus
from app.models.connection import (
    FederationConnection,
    FederationTransaction,
    FederationAlert,
    ConnectionState,
    TransactionType,
    TransactionStatus,
    AlertSeverity,
    AlertStatus,
)
from app.services.waldur_client import WaldurClient, WaldurClientError

logger = logging.getLogger(__name__)


class HealthMonitorService:
    """Service for monitoring Waldur instance health."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize health monitor service."""
        self.session = session

    async def check_instance_health(self, instance_id: UUID) -> dict:
        """Check health of a single Waldur instance.

        Args:
            instance_id: UUID of the instance to check

        Returns:
            Dict with health check results
        """
        result = await self.session.execute(
            select(WaldurInstance).where(WaldurInstance.id == instance_id)
        )
        instance = result.scalar_one_or_none()

        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        health_result = {
            "instance_id": str(instance_id),
            "instance_name": instance.name,
            "previous_status": instance.connection_status.value,
            "new_status": None,
            "healthy": False,
            "version": None,
            "response_time_ms": None,
            "error": None,
        }

        try:
            async with WaldurClient(
                base_url=instance.api_url,
                api_token=instance.api_token,
            ) as client:
                health = await client.check_health()

                health_result["healthy"] = health["healthy"]
                health_result["version"] = health["version"]
                health_result["response_time_ms"] = health["response_time_ms"]
                health_result["error"] = health["error"]

                # Determine connection status
                if health["healthy"]:
                    # Check response time for degraded status
                    if health["response_time_ms"] and health["response_time_ms"] > 5000:
                        new_status = ConnectionStatus.DEGRADED
                    else:
                        new_status = ConnectionStatus.ONLINE

                    # Update instance stats if healthy
                    try:
                        stats = await client.get_instance_stats()
                        instance.offering_count = stats.get("offerings", 0)
                        instance.customer_count = stats.get("customers", 0)
                        instance.project_count = stats.get("projects", 0)
                    except WaldurClientError:
                        pass  # Stats update is optional

                    # Update version if available
                    if health["version"]:
                        instance.version = health["version"]

                else:
                    new_status = ConnectionStatus.OFFLINE

                # Update instance
                instance.connection_status = new_status
                instance.last_health_check = datetime.utcnow()
                instance.last_seen = datetime.utcnow() if health["healthy"] else instance.last_seen
                instance.health_check_error = health["error"]
                instance.updated_at = datetime.utcnow()

                health_result["new_status"] = new_status.value

                # Create alert if status changed to offline
                if (
                    new_status == ConnectionStatus.OFFLINE
                    and instance.connection_status != ConnectionStatus.OFFLINE
                ):
                    await self._create_offline_alert(instance)

                await self.session.commit()

        except Exception as e:
            logger.error(f"Health check failed for instance {instance_id}: {e}")
            health_result["error"] = str(e)
            health_result["new_status"] = ConnectionStatus.OFFLINE.value

            instance.connection_status = ConnectionStatus.OFFLINE
            instance.last_health_check = datetime.utcnow()
            instance.health_check_error = str(e)
            instance.updated_at = datetime.utcnow()

            await self._create_offline_alert(instance)
            await self.session.commit()

        return health_result

    async def _create_offline_alert(self, instance: WaldurInstance) -> None:
        """Create an alert for an instance going offline."""
        # Check if there's already an active alert for this instance
        existing = await self.session.execute(
            select(FederationAlert).where(
                FederationAlert.instance_id == instance.id,
                FederationAlert.alert_type == "instance_offline",
                FederationAlert.status == AlertStatus.ACTIVE,
            )
        )
        if existing.scalar_one_or_none():
            return  # Alert already exists

        alert = FederationAlert(
            federation_id=instance.federation_id,
            instance_id=instance.id,
            severity=AlertSeverity.ERROR,
            alert_type="instance_offline",
            title=f"Instance '{instance.name}' is offline",
            description=(
                f"The Waldur instance at {instance.api_url} is not responding. "
                f"Last error: {instance.health_check_error or 'Unknown'}"
            ),
            context={
                "api_url": instance.api_url,
                "last_seen": instance.last_seen.isoformat() if instance.last_seen else None,
            },
        )
        self.session.add(alert)

    async def check_all_instances(self, federation_id: UUID) -> dict:
        """Check health of all active instances in a federation.

        Args:
            federation_id: UUID of the federation

        Returns:
            Dict with overall health check statistics
        """
        result = await self.session.execute(
            select(WaldurInstance).where(
                WaldurInstance.federation_id == federation_id,
                WaldurInstance.status == InstanceStatus.ACTIVE,
            )
        )
        instances = result.scalars().all()

        stats = {
            "federation_id": str(federation_id),
            "instances_checked": 0,
            "online": 0,
            "offline": 0,
            "degraded": 0,
            "errors": [],
        }

        for instance in instances:
            try:
                health = await self.check_instance_health(instance.id)
                stats["instances_checked"] += 1

                if health["new_status"] == ConnectionStatus.ONLINE.value:
                    stats["online"] += 1
                elif health["new_status"] == ConnectionStatus.OFFLINE.value:
                    stats["offline"] += 1
                elif health["new_status"] == ConnectionStatus.DEGRADED.value:
                    stats["degraded"] += 1

            except Exception as e:
                stats["errors"].append({
                    "instance_id": str(instance.id),
                    "instance_name": instance.name,
                    "error": str(e),
                })

        return stats


class TransactionService:
    """Service for recording and managing federation transactions."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize transaction service."""
        self.session = session

    async def record_transaction(
        self,
        federation_id: UUID,
        source_instance_id: UUID,
        transaction_type: TransactionType,
        target_instance_id: UUID | None = None,
        connection_id: UUID | None = None,
        payload: dict | None = None,
    ) -> FederationTransaction:
        """Record a new federation transaction.

        Args:
            federation_id: UUID of the federation
            source_instance_id: UUID of the source instance
            transaction_type: Type of transaction
            target_instance_id: Optional UUID of target instance
            connection_id: Optional UUID of related connection
            payload: Optional transaction payload data

        Returns:
            Created transaction record
        """
        transaction = FederationTransaction(
            federation_id=federation_id,
            source_instance_id=source_instance_id,
            target_instance_id=target_instance_id,
            connection_id=connection_id,
            transaction_type=transaction_type,
            status=TransactionStatus.PENDING,
            payload=payload or {},
            created_at=datetime.utcnow(),
        )
        self.session.add(transaction)
        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction

    async def start_transaction(self, transaction_id: UUID) -> FederationTransaction:
        """Mark a transaction as started.

        Args:
            transaction_id: UUID of the transaction

        Returns:
            Updated transaction record
        """
        result = await self.session.execute(
            select(FederationTransaction).where(FederationTransaction.id == transaction_id)
        )
        transaction = result.scalar_one_or_none()

        if not transaction:
            raise ValueError(f"Transaction {transaction_id} not found")

        transaction.status = TransactionStatus.IN_PROGRESS
        transaction.started_at = datetime.utcnow()
        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction

    async def complete_transaction(
        self,
        transaction_id: UUID,
        result_data: dict | None = None,
    ) -> FederationTransaction:
        """Mark a transaction as completed.

        Args:
            transaction_id: UUID of the transaction
            result_data: Optional result data

        Returns:
            Updated transaction record
        """
        result = await self.session.execute(
            select(FederationTransaction).where(FederationTransaction.id == transaction_id)
        )
        transaction = result.scalar_one_or_none()

        if not transaction:
            raise ValueError(f"Transaction {transaction_id} not found")

        transaction.status = TransactionStatus.COMPLETED
        transaction.completed_at = datetime.utcnow()
        transaction.result = result_data or {}

        if transaction.started_at:
            duration = (transaction.completed_at - transaction.started_at).total_seconds()
            transaction.duration_ms = int(duration * 1000)

        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction

    async def fail_transaction(
        self,
        transaction_id: UUID,
        error_message: str,
    ) -> FederationTransaction:
        """Mark a transaction as failed.

        Args:
            transaction_id: UUID of the transaction
            error_message: Error description

        Returns:
            Updated transaction record
        """
        result = await self.session.execute(
            select(FederationTransaction).where(FederationTransaction.id == transaction_id)
        )
        transaction = result.scalar_one_or_none()

        if not transaction:
            raise ValueError(f"Transaction {transaction_id} not found")

        transaction.status = TransactionStatus.FAILED
        transaction.completed_at = datetime.utcnow()
        transaction.error_message = error_message
        transaction.retry_count += 1

        if transaction.started_at:
            duration = (transaction.completed_at - transaction.started_at).total_seconds()
            transaction.duration_ms = int(duration * 1000)

        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction


class AlertService:
    """Service for managing federation alerts."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize alert service."""
        self.session = session

    async def create_alert(
        self,
        federation_id: UUID,
        severity: AlertSeverity,
        alert_type: str,
        title: str,
        description: str,
        instance_id: UUID | None = None,
        connection_id: UUID | None = None,
        transaction_id: UUID | None = None,
        context: dict | None = None,
    ) -> FederationAlert:
        """Create a new alert.

        Args:
            federation_id: UUID of the federation
            severity: Alert severity level
            alert_type: Type identifier for the alert
            title: Short alert title
            description: Detailed alert description
            instance_id: Optional related instance
            connection_id: Optional related connection
            transaction_id: Optional related transaction
            context: Optional additional context

        Returns:
            Created alert record
        """
        alert = FederationAlert(
            federation_id=federation_id,
            instance_id=instance_id,
            connection_id=connection_id,
            transaction_id=transaction_id,
            severity=severity,
            alert_type=alert_type,
            title=title,
            description=description,
            context=context or {},
        )
        self.session.add(alert)
        await self.session.commit()
        await self.session.refresh(alert)
        return alert

    async def auto_resolve_stale_alerts(self, federation_id: UUID) -> int:
        """Auto-resolve alerts that are no longer relevant.

        Args:
            federation_id: UUID of the federation

        Returns:
            Number of alerts resolved
        """
        # Get instances that are now online
        online_instances = await self.session.execute(
            select(WaldurInstance.id).where(
                WaldurInstance.federation_id == federation_id,
                WaldurInstance.connection_status == ConnectionStatus.ONLINE,
            )
        )
        online_ids = [row[0] for row in online_instances.all()]

        # Resolve offline alerts for instances that are now online
        alerts_resolved = 0
        result = await self.session.execute(
            select(FederationAlert).where(
                FederationAlert.federation_id == federation_id,
                FederationAlert.alert_type == "instance_offline",
                FederationAlert.status == AlertStatus.ACTIVE,
                FederationAlert.instance_id.in_(online_ids),
            )
        )

        for alert in result.scalars().all():
            alert.status = AlertStatus.RESOLVED
            alert.resolved_at = datetime.utcnow()
            alerts_resolved += 1

        if alerts_resolved > 0:
            await self.session.commit()

        return alerts_resolved


# Background task functions


async def run_health_checks(federation_id: UUID) -> dict:
    """Background task to run health checks for all instances.

    Args:
        federation_id: UUID of the federation

    Returns:
        Health check statistics
    """
    async with async_session() as session:
        service = HealthMonitorService(session)
        return await service.check_all_instances(federation_id)


async def run_alert_maintenance(federation_id: UUID) -> dict:
    """Background task to maintain alerts.

    Args:
        federation_id: UUID of the federation

    Returns:
        Maintenance statistics
    """
    async with async_session() as session:
        service = AlertService(session)
        resolved = await service.auto_resolve_stale_alerts(federation_id)
        return {"alerts_auto_resolved": resolved}
