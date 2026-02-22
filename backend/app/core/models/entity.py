"""Entity and SubordinateStatement models for OpenID Federation."""

import enum
import uuid
from datetime import datetime

from sqlmodel import Column, Field, SQLModel, String


class EntityStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    REVOKED = "revoked"


class Entity(SQLModel, table=True):
    __tablename__ = "entities"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    entity_id: str = Field(sa_column=Column(String, unique=True, nullable=False, index=True))
    name: str
    organization: str | None = None
    country: str | None = None  # ISO alpha-2
    entity_types: str = Field(default="[]")  # JSON list, e.g. ["openid_relying_party"]
    entity_metadata: str = Field(default="{}")  # JSON
    jwks: str = Field(default="{}")  # JSON JWK Set
    status: EntityStatus = Field(default=EntityStatus.DRAFT)
    authority_hints: str = Field(default="[]")  # JSON list of URLs
    contacts: str = Field(default="[]")  # JSON list of email addresses
    statement_expires_seconds: int | None = None  # Override default
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SubordinateStatement(SQLModel, table=True):
    __tablename__ = "subordinate_statements"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    issuer_id: uuid.UUID = Field(foreign_key="entities.id", index=True)
    subject_id: uuid.UUID = Field(foreign_key="entities.id", index=True)
    issuer_entity_id: str  # denormalized for fast lookup
    subject_entity_id: str = Field(index=True)  # denormalized
    metadata_override: str = Field(default="{}")  # JSON
    metadata_policy: str = Field(default="{}")  # JSON
    constraints: str = Field(default="{}")  # JSON
    trust_marks: str = Field(default="[]")  # JSON
    issued_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    jwt: str = ""  # signed JWT string
    is_current: bool = Field(default=True)
