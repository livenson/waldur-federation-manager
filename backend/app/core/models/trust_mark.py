"""TrustMarkDefinition and TrustMark models."""

import enum
import uuid
from datetime import datetime

from sqlmodel import Column, Field, SQLModel, String


class TrustMarkStatus(str, enum.Enum):
    ACTIVE = "active"
    REVOKED = "revoked"


class TrustMarkDefinition(SQLModel, table=True):
    __tablename__ = "trust_mark_definitions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trust_mark_id: str = Field(
        sa_column=Column(String, unique=True, nullable=False, index=True)
    )
    name: str
    description: str | None = None
    ref: str | None = None  # URL to spec/docs
    logo_uri: str | None = None
    allowed_issuer_ids: str = Field(default="[]")  # JSON list of entity_ids
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TrustMark(SQLModel, table=True):
    __tablename__ = "trust_marks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    definition_id: uuid.UUID = Field(foreign_key="trust_mark_definitions.id", index=True)
    subject_id: uuid.UUID = Field(foreign_key="entities.id", index=True)
    issuer_id: uuid.UUID = Field(foreign_key="entities.id")
    subject_entity_id: str  # denormalized
    trust_mark_id: str = Field(index=True)  # denormalized
    issued_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime | None = None
    jwt: str = ""
    status: TrustMarkStatus = Field(default=TrustMarkStatus.ACTIVE)
    revoked_at: datetime | None = None
    revocation_reason: str | None = None
