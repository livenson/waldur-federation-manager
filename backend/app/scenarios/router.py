"""Scenario runner API — list and execute predefined scenarios."""

import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.scenarios import get_scenario, list_scenarios
from app.scenarios.schemas import ScenarioListResponse, ScenarioRunResponse

router = APIRouter(prefix="/api/scenarios", tags=["Scenarios"])


@router.get("/", response_model=ScenarioListResponse)
async def list_all_scenarios() -> ScenarioListResponse:
    """List all available scenarios."""
    return ScenarioListResponse(scenarios=list_scenarios())


@router.post("/{scenario_id}/run", response_model=ScenarioRunResponse)
async def run_scenario(
    scenario_id: str,
    session: AsyncSession = Depends(get_session),
) -> ScenarioRunResponse:
    """Execute a scenario and return step-by-step results."""
    entry = get_scenario(scenario_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    meta, fn = entry
    start = time.monotonic()
    steps = await fn(session)
    total_ms = (time.monotonic() - start) * 1000

    statuses = {s.status for s in steps}
    if "failed" in statuses:
        overall = "failed"
    elif "skipped" in statuses:
        overall = "partial"
    else:
        overall = "passed"

    return ScenarioRunResponse(
        scenario_id=meta.id,
        scenario_name=meta.name,
        status=overall,
        steps=steps,
        duration_ms=round(total_ms, 1),
    )
