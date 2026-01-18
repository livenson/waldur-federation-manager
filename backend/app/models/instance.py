"""Waldur Instance data model for federation discovery."""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Column, Field, JSON, SQLModel


class InstanceStatus(str, Enum):
    """Instance registration status."""

    PENDING = "pending"  # Awaiting approval
    ACTIVE = "active"  # Approved and active
    SUSPENDED = "suspended"  # Temporarily suspended
    REJECTED = "rejected"  # Registration rejected


class ConnectionStatus(str, Enum):
    """Live connection status."""

    UNKNOWN = "unknown"  # Never checked
    ONLINE = "online"  # Reachable and responding
    OFFLINE = "offline"  # Not reachable
    DEGRADED = "degraded"  # Reachable but slow/errors
    MAINTENANCE = "maintenance"  # Planned downtime


class InstanceBase(SQLModel):
    """Base Waldur instance fields."""

    # Waldur instance connection details
    name: str = Field(min_length=1, max_length=255, description="Instance display name")
    api_url: str = Field(max_length=500, description="Waldur API base URL")
    homepage_url: str | None = Field(default=None, max_length=500, description="Public homepage")

    # Instance identification
    uuid: str | None = Field(
        default=None,
        max_length=50,
        description="Waldur instance UUID (from /api/configuration/)",
    )
    version: str | None = Field(default=None, max_length=50, description="Waldur version")

    # Organization info
    organization_name: str = Field(max_length=255, description="Operating organization")
    country: str = Field(min_length=2, max_length=2, description="ISO 3166-1 alpha-2 country code")
    description: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = Field(default=None, max_length=500)

    # Contact
    admin_email: str = Field(max_length=255, description="Technical contact email")
    admin_name: str | None = Field(default=None, max_length=100)

    # Capabilities (what this instance can offer to federation)
    capabilities: list[str] = Field(
        default=[],
        sa_column=Column(JSON),
        description="Federation capabilities: remote_customer, shared_offerings, usage_reporting",
    )

    # Tags for discovery
    tags: list[str] = Field(default=[], sa_column=Column(JSON))


class WaldurInstance(InstanceBase, table=True):
    """Waldur instance database model."""

    __tablename__ = "waldur_instances"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    federation_id: UUID = Field(foreign_key="federations.id", index=True)

    # API authentication (encrypted in production)
    api_token: str | None = Field(
        default=None, max_length=500, description="API token for federation operations"
    )

    # Registration status
    status: InstanceStatus = Field(default=InstanceStatus.PENDING)
    registered_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: datetime | None = Field(default=None)
    approved_by: UUID | None = Field(default=None)

    # Terms of Service acceptance
    tos_accepted: bool = Field(default=False)
    tos_accepted_at: datetime | None = Field(default=None)
    tos_accepted_version: str | None = Field(default=None, max_length=50)

    # Live connection status
    connection_status: ConnectionStatus = Field(default=ConnectionStatus.UNKNOWN)
    last_seen: datetime | None = Field(default=None)
    last_health_check: datetime | None = Field(default=None)
    health_check_error: str | None = Field(default=None, max_length=1000)

    # Statistics
    offering_count: int = Field(default=0, description="Number of offerings available")
    customer_count: int = Field(default=0, description="Number of customers")
    project_count: int = Field(default=0, description="Number of projects")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InstanceCreate(InstanceBase):
    """Schema for registering an instance."""

    api_token: str | None = None
    tos_accepted: bool = False


class InstanceUpdate(SQLModel):
    """Schema for updating an instance."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    api_url: str | None = None
    homepage_url: str | None = None
    organization_name: str | None = None
    country: str | None = None
    description: str | None = None
    logo_url: str | None = None
    admin_email: str | None = None
    admin_name: str | None = None
    capabilities: list[str] | None = None
    tags: list[str] | None = None
    api_token: str | None = None
    status: InstanceStatus | None = None


class InstancePublic(SQLModel):
    """Public instance response schema (no sensitive data)."""

    id: UUID
    federation_id: UUID
    name: str
    api_url: str
    homepage_url: str | None
    uuid: str | None
    version: str | None
    organization_name: str
    country: str
    description: str | None
    logo_url: str | None
    admin_email: str
    capabilities: list[str]
    tags: list[str]
    status: InstanceStatus
    connection_status: ConnectionStatus
    last_seen: datetime | None
    tos_accepted: bool
    offering_count: int
    customer_count: int
    project_count: int
    registered_at: datetime


class InstanceDiscovery(SQLModel):
    """Compact instance info for discovery listings."""

    id: UUID
    name: str
    api_url: str
    organization_name: str
    country: str
    logo_url: str | None
    capabilities: list[str]
    connection_status: ConnectionStatus
    offering_count: int
