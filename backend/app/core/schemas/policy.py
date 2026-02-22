"""Pydantic schemas for MetadataPolicy management API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PolicyCreate(BaseModel):
    name: str
    description: str | None = None
    entity_type: str = Field(..., description="e.g. openid_relying_party, openid_provider")
    policy: dict = Field(default_factory=dict, description="Policy with OIDC Federation operators")


class PolicyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    entity_type: str | None = None
    policy: dict | None = None


class PolicyResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    entity_type: str
    policy: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PolicyListResponse(BaseModel):
    policies: list[PolicyResponse]
    total: int


class EntityComplianceResult(BaseModel):
    entity_id: uuid.UUID
    entity_name: str
    entity_url: str
    status: str  # "compliant" | "non_compliant" | "error"
    violations: list[str]


class PolicyEvaluationResponse(BaseModel):
    policy_id: uuid.UUID
    policy_name: str
    entity_type: str
    total_entities: int
    compliant: int
    non_compliant: int
    results: list[EntityComplianceResult]
