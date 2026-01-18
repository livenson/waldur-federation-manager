"""Federation data model."""

import re
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import field_validator
from sqlmodel import Field, SQLModel


class FederationStatus(str, Enum):
    """Federation status."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"


class FederationBase(SQLModel):
    """Base federation fields."""

    name: str = Field(min_length=1, max_length=255, description="Federation name")
    slug: str = Field(
        min_length=1,
        max_length=100,
        regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$",
        description="URL-friendly identifier",
    )
    description: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = Field(default=None, max_length=500)

    # Federation settings
    public_discovery: bool = Field(
        default=True, description="Allow public browsing of registered instances"
    )
    require_approval: bool = Field(
        default=True, description="Require approval for new instance registrations"
    )
    require_tos_acceptance: bool = Field(
        default=True, description="Require ToS acceptance before joining"
    )

    # Contact information
    admin_email: str = Field(max_length=255, description="Federation administrator email")
    website_url: str | None = Field(default=None, max_length=500)

    # Terms of Service
    tos_url: str | None = Field(default=None, max_length=500, description="Terms of Service URL")
    tos_version: str | None = Field(default=None, max_length=50, description="Current ToS version")

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        """Validate slug format."""
        if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", v) and len(v) > 1:
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        if len(v) == 1 and not v.isalnum():
            raise ValueError("Single character slug must be alphanumeric")
        return v.lower()


class Federation(FederationBase, table=True):
    """Federation database model."""

    __tablename__ = "federations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    status: FederationStatus = Field(default=FederationStatus.ACTIVE)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Statistics (denormalized for performance)
    instance_count: int = Field(default=0)
    active_connections: int = Field(default=0)


class FederationCreate(FederationBase):
    """Schema for creating a federation."""

    pass


class FederationUpdate(SQLModel):
    """Schema for updating a federation."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    logo_url: str | None = None
    public_discovery: bool | None = None
    require_approval: bool | None = None
    require_tos_acceptance: bool | None = None
    admin_email: str | None = Field(default=None, max_length=255)
    website_url: str | None = None
    tos_url: str | None = None
    tos_version: str | None = None
    status: FederationStatus | None = None


class FederationPublic(FederationBase):
    """Public federation response schema."""

    id: UUID
    status: FederationStatus
    created_at: datetime
    instance_count: int
    active_connections: int
