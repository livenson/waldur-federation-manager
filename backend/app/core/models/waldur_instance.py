"""WaldurInstance model for federation topology tracking."""

import enum
import uuid
from datetime import datetime

from sqlmodel import Column, Field, SQLModel, String


class InstanceStatus(str, enum.Enum):
    UNKNOWN = "unknown"
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"


class WaldurInstance(SQLModel, table=True):
    __tablename__ = "waldur_instances"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    base_url: str = Field(sa_column=Column(String, unique=True, nullable=False, index=True))
    status: InstanceStatus = Field(default=InstanceStatus.UNKNOWN)
    last_seen_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
