"""Pydantic schemas for SubordinateStatement management API."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class StatementCreate(BaseModel):
    subject_entity_id: str
    metadata_override: dict | None = None
    metadata_policy: dict | None = None
    constraints: dict | None = None
    trust_marks: list[dict] | None = None
    expires_in_seconds: int | None = None


class StatementUpdate(BaseModel):
    metadata_override: dict | None = None
    metadata_policy: dict | None = None
    constraints: dict | None = None
    trust_marks: list[dict] | None = None


class StatementResponse(BaseModel):
    id: uuid.UUID
    issuer_entity_id: str
    subject_entity_id: str
    metadata_override: dict
    metadata_policy: dict
    constraints: dict
    trust_marks: list
    issued_at: datetime
    expires_at: datetime
    jwt: str
    is_current: bool

    model_config = {"from_attributes": True}


class StatementListResponse(BaseModel):
    statements: list[StatementResponse]
    total: int
