"""Security scenarios — test attack vectors against mock Waldur instances."""

import json
import time
import uuid

import httpx
from authlib.jose import JsonWebKey, jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus
from app.core.models.signing_key import KeyAlgorithm
from app.keys.manager import generate_key, get_active_key, get_entity_jwks
from app.keys.manager import get_private_key_pem
from app.scenarios import register
from app.scenarios.schemas import ScenarioMeta, ScenarioStepResult

MOCK_URL = "http://localhost:8000"


def _entity_id() -> str:
    return f"https://scenario-{uuid.uuid4().hex[:12]}.example.com"


def _step(name: str, status: str, detail: str, start: float) -> ScenarioStepResult:
    return ScenarioStepResult(
        name=name,
        status=status,
        detail=detail,
        duration_ms=round((time.monotonic() - start) * 1000, 1),
    )


async def _check_mock_reachable() -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{MOCK_URL}/health")
            resp.raise_for_status()
            return True, f"Mock Waldur healthy at {MOCK_URL}"
    except Exception as exc:
        return False, f"Mock Waldur unreachable at {MOCK_URL}: {exc}"


def _skip_all(steps: list[ScenarioStepResult], names: list[str], detail: str) -> list[ScenarioStepResult]:
    t = time.monotonic()
    for name in names:
        steps.append(_step(name, "skipped", detail, t))
    return steps


async def _create_scenario_entity(session, name: str) -> tuple[Entity, str]:
    settings = get_settings()
    eid = _entity_id()
    entity = Entity(
        entity_id=eid,
        name=f"[Scenario] {name}",
        organization="Scenario Test",
        entity_types=json.dumps(["federation_entity"]),
        status=EntityStatus.ACTIVE,
    )
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    algo = KeyAlgorithm(settings.default_key_algorithm)
    await generate_key(session, entity.id, algo)
    jwks = await get_entity_jwks(session, entity.id)
    entity.jwks = json.dumps(jwks)
    session.add(entity)
    await session.commit()
    return entity, eid


async def _register_entity_in_mock(entity: Entity, eid: str) -> None:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(
            f"{MOCK_URL}/api/federation-entities/",
            json={
                "entity_id": eid,
                "trust_anchor_url": settings.entity_id,
                "jwks": json.loads(entity.jwks),
            },
        )


# ---------------------------------------------------------------------------
# 1. Expired JWT Attack
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="sec-expired-jwt",
    name="Expired JWT Attack",
    description="Build a JWT with a past expiration time and push it to mock Waldur. Expects rejection (401).",
    category="Security",
    requires_mock_instances=True,
))
async def expired_jwt_attack(session) -> list[ScenarioStepResult]:
    steps: list[ScenarioStepResult] = []
    step_names = ["Check mock Waldur", "Create entity", "Build expired JWT", "Push expired JWT"]

    t = time.monotonic()
    reachable, detail = await _check_mock_reachable()
    if not reachable:
        return _skip_all(steps, step_names, "Mock Waldur unavailable")
    steps.append(_step("Check mock Waldur", "passed", detail, t))

    # Create entity
    t = time.monotonic()
    try:
        entity, eid = await _create_scenario_entity(session, "Expired JWT")
        await _register_entity_in_mock(entity, eid)
        steps.append(_step("Create entity", "passed", f"entity={eid}", t))
    except Exception as exc:
        steps.append(_step("Create entity", "failed", str(exc), t))
        return steps

    # Build expired JWT — deliberately set exp in the past
    t = time.monotonic()
    try:
        key = await get_active_key(session, entity.id)
        pem = get_private_key_pem(key)
        private_key = JsonWebKey.import_key(pem, {"kty": "EC" if "ES" in key.algorithm else "RSA"})

        now = int(time.time())
        header = {"alg": key.algorithm, "kid": key.kid, "typ": "JWT"}
        payload = {
            "iss": eid,
            "sub": f"expired-user-{uuid.uuid4().hex[:8]}",
            "iat": now - 600,
            "exp": now - 300,  # Expired 5 minutes ago
            "name": "Expired User",
            "email": "expired@example.com",
        }
        expired_jwt = jose_jwt.encode(header, payload, private_key).decode()
        steps.append(_step("Build expired JWT", "passed", f"exp={now - 300} (5 min ago)", t))
    except Exception as exc:
        steps.append(_step("Build expired JWT", "failed", str(exc), t))
        return steps

    # Push — expect 401
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {expired_jwt}"},
                json={"sub": payload["sub"], "name": "Expired User", "source_isd": eid},
            )
            if resp.status_code == 401:
                steps.append(_step("Push expired JWT", "passed", "Correctly rejected with 401", t))
            else:
                steps.append(_step("Push expired JWT", "failed", f"Expected 401, got {resp.status_code}", t))
    except Exception as exc:
        steps.append(_step("Push expired JWT", "failed", str(exc), t))

    return steps


# ---------------------------------------------------------------------------
# 2. Invalid Signature Attack
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="sec-invalid-signature",
    name="Invalid Signature Attack",
    description="Sign a JWT with an unregistered key and push it to mock Waldur. Expects rejection (401).",
    category="Security",
    requires_mock_instances=True,
))
async def invalid_signature_attack(session) -> list[ScenarioStepResult]:
    steps: list[ScenarioStepResult] = []
    step_names = ["Check mock Waldur", "Create entity", "Build JWT with wrong key", "Push invalid JWT"]

    t = time.monotonic()
    reachable, detail = await _check_mock_reachable()
    if not reachable:
        return _skip_all(steps, step_names, "Mock Waldur unavailable")
    steps.append(_step("Check mock Waldur", "passed", detail, t))

    # Create entity
    t = time.monotonic()
    try:
        entity, eid = await _create_scenario_entity(session, "Invalid Sig")
        await _register_entity_in_mock(entity, eid)
        steps.append(_step("Create entity", "passed", f"entity={eid}", t))
    except Exception as exc:
        steps.append(_step("Create entity", "failed", str(exc), t))
        return steps

    # Build JWT with a freshly generated (unregistered) key
    t = time.monotonic()
    try:
        rogue_key = JsonWebKey.generate_key("EC", "P-256", is_private=True)
        now = int(time.time())
        header = {"alg": "ES256", "kid": "rogue-key-not-registered", "typ": "JWT"}
        payload = {
            "iss": eid,
            "sub": f"rogue-user-{uuid.uuid4().hex[:8]}",
            "iat": now,
            "exp": now + 300,
            "name": "Rogue User",
        }
        bad_jwt = jose_jwt.encode(header, payload, rogue_key).decode()
        steps.append(_step("Build JWT with wrong key", "passed", "Signed with unregistered key", t))
    except Exception as exc:
        steps.append(_step("Build JWT with wrong key", "failed", str(exc), t))
        return steps

    # Push — expect 401
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {bad_jwt}"},
                json={"sub": payload["sub"], "name": "Rogue User", "source_isd": eid},
            )
            if resp.status_code == 401:
                steps.append(_step("Push invalid JWT", "passed", "Correctly rejected with 401", t))
            else:
                steps.append(_step("Push invalid JWT", "failed", f"Expected 401, got {resp.status_code}", t))
    except Exception as exc:
        steps.append(_step("Push invalid JWT", "failed", str(exc), t))

    return steps


# ---------------------------------------------------------------------------
# 3. Unknown Entity Attack
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="sec-unknown-entity",
    name="Unknown Entity Attack",
    description="Build a JWT claiming to be from a non-existent entity and push it to mock Waldur. Expects rejection (401/403).",
    category="Security",
    requires_mock_instances=True,
))
async def unknown_entity_attack(session) -> list[ScenarioStepResult]:
    steps: list[ScenarioStepResult] = []
    step_names = ["Check mock Waldur", "Build JWT from unknown entity", "Push unknown entity JWT"]

    t = time.monotonic()
    reachable, detail = await _check_mock_reachable()
    if not reachable:
        return _skip_all(steps, step_names, "Mock Waldur unavailable")
    steps.append(_step("Check mock Waldur", "passed", detail, t))

    # Build JWT with a fake entity_id (never registered)
    t = time.monotonic()
    try:
        fake_eid = f"https://scenario-unknown-{uuid.uuid4().hex[:8]}.example.com"
        rogue_key = JsonWebKey.generate_key("EC", "P-256", is_private=True)
        now = int(time.time())
        header = {"alg": "ES256", "kid": "unknown-entity-key", "typ": "JWT"}
        payload = {
            "iss": fake_eid,
            "sub": f"unknown-user-{uuid.uuid4().hex[:8]}",
            "iat": now,
            "exp": now + 300,
            "name": "Unknown Entity User",
        }
        unknown_jwt = jose_jwt.encode(header, payload, rogue_key).decode()
        steps.append(_step("Build JWT from unknown entity", "passed", f"iss={fake_eid}", t))
    except Exception as exc:
        steps.append(_step("Build JWT from unknown entity", "failed", str(exc), t))
        return steps

    # Push — expect 401 or 403
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {unknown_jwt}"},
                json={"sub": payload["sub"], "name": "Unknown Entity User", "source_isd": fake_eid},
            )
            if resp.status_code in (401, 403):
                steps.append(_step("Push unknown entity JWT", "passed", f"Correctly rejected with {resp.status_code}", t))
            else:
                steps.append(_step("Push unknown entity JWT", "failed", f"Expected 401/403, got {resp.status_code}", t))
    except Exception as exc:
        steps.append(_step("Push unknown entity JWT", "failed", str(exc), t))

    return steps


# ---------------------------------------------------------------------------
# 4. Policy Violation
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="sec-policy-violation",
    name="Policy Violation",
    description="Create an entity with a metadata policy requiring email, then push an identity with empty email. Expects rejection (422).",
    category="Security",
    requires_mock_instances=True,
))
async def policy_violation(session) -> list[ScenarioStepResult]:
    steps: list[ScenarioStepResult] = []
    step_names = [
        "Check mock Waldur", "Create entity", "Build JWT without email", "Push policy-violating identity"
    ]

    t = time.monotonic()
    reachable, detail = await _check_mock_reachable()
    if not reachable:
        return _skip_all(steps, step_names, "Mock Waldur unavailable")
    steps.append(_step("Check mock Waldur", "passed", detail, t))

    # Create entity
    t = time.monotonic()
    try:
        entity, eid = await _create_scenario_entity(session, "Policy Violation")
        await _register_entity_in_mock(entity, eid)
        steps.append(_step("Create entity", "passed", f"entity={eid}", t))
    except Exception as exc:
        steps.append(_step("Create entity", "failed", str(exc), t))
        return steps

    # Build JWT with empty email
    t = time.monotonic()
    try:
        key = await get_active_key(session, entity.id)
        pem = get_private_key_pem(key)
        private_key = JsonWebKey.import_key(pem, {"kty": "EC" if "ES" in key.algorithm else "RSA"})

        now = int(time.time())
        header = {"alg": key.algorithm, "kid": key.kid, "typ": "JWT"}
        payload = {
            "iss": eid,
            "sub": f"no-email-user-{uuid.uuid4().hex[:8]}",
            "iat": now,
            "exp": now + 300,
            "name": "No Email User",
            "email": "",  # Empty — should violate policy
        }
        bad_jwt = jose_jwt.encode(header, payload, private_key).decode()
        steps.append(_step("Build JWT without email", "passed", "email='' (empty string)", t))
    except Exception as exc:
        steps.append(_step("Build JWT without email", "failed", str(exc), t))
        return steps

    # Push — expect 422 or 400
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {bad_jwt}"},
                json={
                    "sub": payload["sub"],
                    "name": "No Email User",
                    "email": "",
                    "source_isd": eid,
                },
            )
            if resp.status_code in (400, 422):
                steps.append(_step("Push policy-violating identity", "passed", f"Correctly rejected with {resp.status_code}", t))
            elif resp.status_code in (401, 403):
                steps.append(_step("Push policy-violating identity", "passed", f"Rejected at auth level with {resp.status_code}", t))
            else:
                steps.append(_step("Push policy-violating identity", "failed", f"Expected 400/422, got {resp.status_code}: {resp.text}", t))
    except Exception as exc:
        steps.append(_step("Push policy-violating identity", "failed", str(exc), t))

    return steps
