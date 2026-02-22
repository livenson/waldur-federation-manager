"""Scenario registry — discover and run predefined federation scenarios."""

from collections.abc import Callable, Coroutine
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.scenarios.schemas import ScenarioMeta, ScenarioStepResult

# Type alias for scenario functions
ScenarioFn = Callable[[AsyncSession], Coroutine[Any, Any, list[ScenarioStepResult]]]

_SCENARIOS: dict[str, tuple[ScenarioMeta, ScenarioFn]] = {}


def register(meta: ScenarioMeta):
    """Decorator to register a scenario function."""

    def decorator(fn: ScenarioFn) -> ScenarioFn:
        _SCENARIOS[meta.id] = (meta, fn)
        return fn

    return decorator


def list_scenarios() -> list[ScenarioMeta]:
    return [meta for meta, _fn in _SCENARIOS.values()]


def get_scenario(scenario_id: str) -> tuple[ScenarioMeta, ScenarioFn] | None:
    return _SCENARIOS.get(scenario_id)


# Import scenario modules so they self-register via @register
from app.scenarios import trust_anchor, federation, security  # noqa: E402, F401
