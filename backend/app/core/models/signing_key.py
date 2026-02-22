"""SigningKey model for key management."""

import enum
import uuid
from datetime import datetime

from sqlmodel import Column, Field, SQLModel, String


class KeyAlgorithm(str, enum.Enum):
    ES256 = "ES256"
    RS256 = "RS256"


class KeyStatus(str, enum.Enum):
    ACTIVE = "active"
    ROTATED = "rotated"
    REVOKED = "revoked"


class SigningKey(SQLModel, table=True):
    __tablename__ = "signing_keys"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    entity_id: uuid.UUID = Field(foreign_key="entities.id", index=True)
    kid: str = Field(sa_column=Column(String, unique=True, nullable=False, index=True))
    algorithm: KeyAlgorithm = Field(default=KeyAlgorithm.ES256)
    public_key_jwk: str  # JWK JSON string
    private_key_encrypted: str  # Fernet-encrypted PEM
    status: KeyStatus = Field(default=KeyStatus.ACTIVE)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    rotated_at: datetime | None = None
    revoked_at: datetime | None = None
