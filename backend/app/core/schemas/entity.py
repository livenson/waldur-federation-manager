"""Pydantic schemas for Entity management API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.models.entity import EntityStatus


class EntityCreate(BaseModel):
    entity_id: str = Field(..., description="URL identifier for the entity")
    name: str
    organization: str | None = None
    country: str | None = None
    entity_types: list[str] = Field(default_factory=list)
    metadata: dict | None = None
    authority_hints: list[str] = Field(default_factory=list)
    contacts: list[str] = Field(default_factory=list)
    statement_expires_seconds: int | None = None
    jwks: dict | None = None  # If provided, use external keys


class EntityUpdate(BaseModel):
    name: str | None = None
    organization: str | None = None
    country: str | None = None
    entity_types: list[str] | None = None
    metadata: dict | None = None
    authority_hints: list[str] | None = None
    contacts: list[str] | None = None
    statement_expires_seconds: int | None = None


class EntityResponse(BaseModel):
    id: uuid.UUID
    entity_id: str
    name: str
    organization: str | None = None
    country: str | None = None
    entity_types: list[str]
    metadata: dict
    jwks: dict
    status: EntityStatus
    authority_hints: list[str]
    contacts: list[str]
    statement_expires_seconds: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EntityListResponse(BaseModel):
    entities: list[EntityResponse]
    total: int
