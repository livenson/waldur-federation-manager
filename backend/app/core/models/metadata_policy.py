"""MetadataPolicy model."""

import uuid
from datetime import datetime

from sqlmodel import Column, Field, SQLModel, String


class MetadataPolicy(SQLModel, table=True):
    __tablename__ = "metadata_policies"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String, unique=True, nullable=False))
    description: str | None = None
    entity_type: str  # e.g. "openid_relying_party", "openid_provider"
    policy: str = Field(default="{}")  # JSON with OIDC Federation policy operators
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
