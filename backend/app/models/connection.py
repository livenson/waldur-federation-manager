"""Federation connection and transaction monitoring models."""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Column, Field, JSON, SQLModel


class ConnectionType(str, Enum):
    """Type of federation connection."""

    REMOTE_CUSTOMER = "remote_customer"  # Shared customer across instances
    SHARED_OFFERING = "shared_offering"  # Offering shared between instances
    USAGE_SYNC = "usage_sync"  # Usage data synchronization


class ConnectionState(str, Enum):
    """State of a federation connection."""

    PENDING = "pending"  # Connection requested
    ACTIVE = "active"  # Connection established
    PAUSED = "paused"  # Temporarily paused
    FAILED = "failed"  # Connection failed
    TERMINATED = "terminated"  # Connection ended


class FederationConnection(SQLModel, table=True):
    """Active connection between two Waldur instances."""

    __tablename__ = "federation_connections"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    federation_id: UUID = Field(foreign_key="federations.id", index=True)

    # Source and target instances
    source_instance_id: UUID = Field(foreign_key="waldur_instances.id", index=True)
    target_instance_id: UUID = Field(foreign_key="waldur_instances.id", index=True)

    # Connection details
    connection_type: ConnectionType
    state: ConnectionState = Field(default=ConnectionState.PENDING)

    # Remote references (UUIDs from the Waldur instances)
    source_reference: str | None = Field(
        default=None, max_length=50, description="Reference ID in source instance"
    )
    target_reference: str | None = Field(
        default=None, max_length=50, description="Reference ID in target instance"
    )

    # Metadata
    connection_metadata: dict = Field(default={}, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    established_at: datetime | None = Field(default=None)
    last_activity: datetime | None = Field(default=None)
    terminated_at: datetime | None = Field(default=None)

    # Error tracking
    error_message: str | None = Field(default=None, max_length=1000)
    error_count: int = Field(default=0)
    last_error_at: datetime | None = Field(default=None)


class TransactionType(str, Enum):
    """Type of federation transaction."""

    # Customer/Project operations
    CUSTOMER_CREATED = "customer_created"
    CUSTOMER_UPDATED = "customer_updated"
    PROJECT_CREATED = "project_created"
    PROJECT_UPDATED = "project_updated"

    # Resource operations
    RESOURCE_CREATED = "resource_created"
    RESOURCE_UPDATED = "resource_updated"
    RESOURCE_TERMINATED = "resource_terminated"

    # Order operations
    ORDER_CREATED = "order_created"
    ORDER_APPROVED = "order_approved"
    ORDER_REJECTED = "order_rejected"
    ORDER_COMPLETED = "order_completed"
    ORDER_FAILED = "order_failed"

    # Usage/Billing
    USAGE_REPORTED = "usage_reported"
    INVOICE_CREATED = "invoice_created"

    # Sync operations
    SYNC_STARTED = "sync_started"
    SYNC_COMPLETED = "sync_completed"
    SYNC_FAILED = "sync_failed"

    # Health/Status
    HEALTH_CHECK = "health_check"
    CONNECTION_ESTABLISHED = "connection_established"
    CONNECTION_LOST = "connection_lost"


class TransactionStatus(str, Enum):
    """Status of a transaction."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class FederationTransaction(SQLModel, table=True):
    """Transaction/event record for monitoring federation activity."""

    __tablename__ = "federation_transactions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    federation_id: UUID = Field(foreign_key="federations.id", index=True)

    # Related entities
    connection_id: UUID | None = Field(default=None, foreign_key="federation_connections.id")
    source_instance_id: UUID = Field(foreign_key="waldur_instances.id", index=True)
    target_instance_id: UUID | None = Field(default=None, foreign_key="waldur_instances.id")

    # Transaction details
    transaction_type: TransactionType
    status: TransactionStatus = Field(default=TransactionStatus.PENDING)

    # External references
    source_object_type: str | None = Field(default=None, max_length=100)
    source_object_id: str | None = Field(default=None, max_length=50)
    target_object_type: str | None = Field(default=None, max_length=100)
    target_object_id: str | None = Field(default=None, max_length=50)

    # Payload and result
    payload: dict = Field(default={}, sa_column=Column(JSON))
    result: dict = Field(default={}, sa_column=Column(JSON))

    # Timing
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    started_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)
    duration_ms: int | None = Field(default=None)

    # Error tracking
    error_message: str | None = Field(default=None, max_length=2000)
    retry_count: int = Field(default=0)


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    """Alert status."""

    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class FederationAlert(SQLModel, table=True):
    """Alerts for federation issues."""

    __tablename__ = "federation_alerts"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    federation_id: UUID = Field(foreign_key="federations.id", index=True)

    # Related entities
    instance_id: UUID | None = Field(default=None, foreign_key="waldur_instances.id")
    connection_id: UUID | None = Field(default=None, foreign_key="federation_connections.id")
    transaction_id: UUID | None = Field(default=None, foreign_key="federation_transactions.id")

    # Alert details
    severity: AlertSeverity
    status: AlertStatus = Field(default=AlertStatus.ACTIVE)
    alert_type: str = Field(max_length=100, description="Alert type identifier")
    title: str = Field(max_length=255)
    description: str = Field(max_length=2000)

    # Context
    context: dict = Field(default={}, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    acknowledged_at: datetime | None = Field(default=None)
    acknowledged_by: UUID | None = Field(default=None)
    resolved_at: datetime | None = Field(default=None)
    resolved_by: UUID | None = Field(default=None)


# Schema classes for API responses

class ConnectionCreate(SQLModel):
    """Schema for creating a connection."""

    source_instance_id: UUID
    target_instance_id: UUID
    connection_type: ConnectionType
    connection_metadata: dict = {}


class ConnectionPublic(SQLModel):
    """Public connection response."""

    id: UUID
    federation_id: UUID
    source_instance_id: UUID
    target_instance_id: UUID
    connection_type: ConnectionType
    state: ConnectionState
    created_at: datetime
    established_at: datetime | None
    last_activity: datetime | None
    error_count: int


class TransactionPublic(SQLModel):
    """Public transaction response."""

    id: UUID
    federation_id: UUID
    source_instance_id: UUID
    target_instance_id: UUID | None
    transaction_type: TransactionType
    status: TransactionStatus
    created_at: datetime
    completed_at: datetime | None
    duration_ms: int | None
    error_message: str | None


class AlertPublic(SQLModel):
    """Public alert response."""

    id: UUID
    federation_id: UUID
    instance_id: UUID | None
    severity: AlertSeverity
    status: AlertStatus
    alert_type: str
    title: str
    description: str
    created_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
