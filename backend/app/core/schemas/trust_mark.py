"""Pydantic schemas for TrustMark management API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.models.trust_mark import TrustMarkStatus


class TrustMarkDefinitionCreate(BaseModel):
    trust_mark_id: str = Field(..., description="URL identifier for the trust mark")
    name: str
    description: str | None = None
    ref: str | None = None
    logo_uri: str | None = None
    allowed_issuer_ids: list[str] = Field(default_factory=list)


class TrustMarkDefinitionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    ref: str | None = None
    logo_uri: str | None = None
    allowed_issuer_ids: list[str] | None = None


class TrustMarkDefinitionResponse(BaseModel):
    id: uuid.UUID
    trust_mark_id: str
    name: str
    description: str | None = None
    ref: str | None = None
    logo_uri: str | None = None
    allowed_issuer_ids: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrustMarkIssue(BaseModel):
    trust_mark_id: str
    subject_entity_id: str
    expires_in_seconds: int | None = None


class TrustMarkResponse(BaseModel):
    id: uuid.UUID
    trust_mark_id: str
    subject_entity_id: str
    issued_at: datetime
    expires_at: datetime | None = None
    jwt: str
    status: TrustMarkStatus
    revoked_at: datetime | None = None
    revocation_reason: str | None = None

    model_config = {"from_attributes": True}


class TrustMarkRevoke(BaseModel):
    reason: str | None = None


class TrustMarkListResponse(BaseModel):
    trust_marks: list[TrustMarkResponse]
    total: int


class TrustMarkDefinitionListResponse(BaseModel):
    definitions: list[TrustMarkDefinitionResponse]
    total: int
