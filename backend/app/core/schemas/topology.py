"""Pydantic schemas for federation topology API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.models.waldur_instance import InstanceStatus


class WaldurInstanceCreate(BaseModel):
    name: str
    base_url: str


class WaldurInstanceResponse(BaseModel):
    id: uuid.UUID
    name: str
    base_url: str
    status: InstanceStatus
    last_seen_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FederationEntityInfo(BaseModel):
    entity_id: str
    isd_source: str | None = None
    trust_anchor_url: str | None = None
    is_active: bool = True


class InstanceHealth(BaseModel):
    instance_id: uuid.UUID
    name: str
    base_url: str
    status: str
    trust_anchor_urls: list[str] = Field(default_factory=list)
    entity_count: int = 0
    user_count: int = 0
    federation_entities: list[FederationEntityInfo] = Field(default_factory=list)


class TopologyNode(BaseModel):
    id: str
    type: str  # "trust_anchor" | "waldur_instance"
    label: str
    data: dict = Field(default_factory=dict)


class TopologyEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str = "trusts"
    label: str | None = None


class TopologySummary(BaseModel):
    total_instances: int = 0
    healthy_instances: int = 0
    total_federations: int = 0
    total_federation_entities: int = 0
    total_users: int = 0


class TopologyResponse(BaseModel):
    instances: list[InstanceHealth] = Field(default_factory=list)
    nodes: list[TopologyNode] = Field(default_factory=list)
    edges: list[TopologyEdge] = Field(default_factory=list)
    summary: TopologySummary = Field(default_factory=TopologySummary)
