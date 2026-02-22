"""Pydantic models for the scenario runner."""

from pydantic import BaseModel


class ScenarioStepResult(BaseModel):
    name: str
    status: str  # "passed", "failed", "skipped"
    detail: str
    duration_ms: float


class ScenarioMeta(BaseModel):
    id: str
    name: str
    description: str
    category: str
    requires_mock_instances: bool = False


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioMeta]


class ScenarioRunResponse(BaseModel):
    scenario_id: str
    scenario_name: str
    status: str  # "passed", "failed", "partial"
    steps: list[ScenarioStepResult]
    duration_ms: float
