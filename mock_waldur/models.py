"""SQLModel tables for the mock Waldur instance."""

import uuid
from datetime import datetime

from sqlmodel import Column, Field, SQLModel, String


class FederationEntity(SQLModel, table=True):
    """Maps a federation entity_id to a local ISD source name."""

    __tablename__ = "federation_entities"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    entity_id: str = Field(sa_column=Column(String, unique=True, nullable=False, index=True))
    isd_source: str = Field(sa_column=Column(String, unique=True, nullable=False))
    trust_anchor_url: str
    jwks: str = Field(default="{}")
    jwks_updated_at: datetime | None = None
    metadata_policy: str = Field(default="{}")
    policy_updated_at: datetime | None = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MockUser(SQLModel, table=True):
    """Simulates Waldur's User model with Identity Bridge fields."""

    __tablename__ = "mock_users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    username: str = Field(sa_column=Column(String, unique=True, nullable=False, index=True))
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    organization: str = ""
    affiliations: str = Field(default="[]")  # JSON list
    country: str = ""
    phone_number: str = ""
    is_active: bool = Field(default=True)
    attribute_sources: str = Field(default="{}")  # JSON: {field: {source, timestamp}}
    active_isds: str = Field(default="[]")  # JSON list of ISD source names
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
