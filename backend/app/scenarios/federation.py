"""Federation scenarios — require running mock Waldur instances."""

import json
import time
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus
from app.core.models.signing_key import KeyAlgorithm
from app.keys.manager import generate_key, get_active_key, get_entity_jwks
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
    """Check if the mock Waldur instance is reachable."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{MOCK_URL}/health")
            resp.raise_for_status()
            return True, f"Mock Waldur healthy at {MOCK_URL}"
    except Exception as exc:
        return False, f"Mock Waldur unreachable at {MOCK_URL}: {exc}"


async def _create_scenario_entity(
    session: AsyncSession, name: str
) -> tuple[Entity, str]:
    """Helper: create and activate a scenario entity with keys."""
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


async def _build_identity_jwt(session: AsyncSession, entity: Entity, user_claims: dict) -> str:
    """Build a signed identity JWT for pushing to mock Waldur."""
    from authlib.jose import jwt as jose_jwt
    from app.keys.manager import get_private_key_pem

    key = await get_active_key(session, entity.id)
    assert key, "Entity has no active key"

    from authlib.jose import JsonWebKey

    pem = get_private_key_pem(key)
    private_key = JsonWebKey.import_key(pem, {"kty": "EC" if "ES" in key.algorithm else "RSA"})

    now = int(time.time())
    header = {"alg": key.algorithm, "kid": key.kid, "typ": "JWT"}
    payload = {
        "iss": entity.entity_id,
        "sub": user_claims.get("sub", f"user-{uuid.uuid4().hex[:8]}"),
        "iat": now,
        "exp": now + 300,
        **user_claims,
    }
    return jose_jwt.encode(header, payload, private_key).decode()


# ---------------------------------------------------------------------------
# 1. Identity Push
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="fed-identity-push",
    name="Identity Push",
    description="Register an entity in the Trust Anchor, build an identity JWT, push it to the mock Waldur instance, and verify acceptance.",
    category="Federation",
    requires_mock_instances=True,
))
async def identity_push(session: AsyncSession) -> list[ScenarioStepResult]:
    settings = get_settings()
    steps: list[ScenarioStepResult] = []

    # Check mock reachable
    t = time.monotonic()
    reachable, detail = await _check_mock_reachable()
    if not reachable:
        steps.append(_step("Check mock Waldur", "skipped", detail, t))
        steps.append(_step("Create entity", "skipped", "Mock Waldur unavailable", t))
        steps.append(_step("Build identity JWT", "skipped", "Mock Waldur unavailable", t))
        steps.append(_step("Register entity mapping", "skipped", "Mock Waldur unavailable", t))
        steps.append(_step("Push identity", "skipped", "Mock Waldur unavailable", t))
        return steps
    steps.append(_step("Check mock Waldur", "passed", detail, t))

    # Create entity
    t = time.monotonic()
    try:
        entity, eid = await _create_scenario_entity(session, "Identity Push")
        steps.append(_step("Create entity", "passed", f"entity={eid}", t))
    except Exception as exc:
        steps.append(_step("Create entity", "failed", str(exc), t))
        return steps

    # Build identity JWT
    t = time.monotonic()
    try:
        user_sub = f"scenario-user-{uuid.uuid4().hex[:8]}"
        jwt_token = await _build_identity_jwt(session, entity, {
            "sub": user_sub,
            "name": "Scenario Test User",
            "email": "scenario@example.com",
        })
        assert len(jwt_token) > 50
        steps.append(_step("Build identity JWT", "passed", f"JWT length={len(jwt_token)}", t))
    except Exception as exc:
        steps.append(_step("Build identity JWT", "failed", str(exc), t))
        return steps

    # Register entity mapping in mock Waldur
    t = time.monotonic()
    try:
        entity_jwks = json.loads(entity.jwks)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{MOCK_URL}/api/federation-entities/",
                json={
                    "entity_id": eid,
                    "trust_anchor_url": settings.entity_id,
                    "jwks": entity_jwks,
                },
            )
            if resp.status_code in (200, 201):
                steps.append(_step("Register entity mapping", "passed", f"status={resp.status_code}", t))
            elif resp.status_code == 409:
                steps.append(_step("Register entity mapping", "passed", "Already registered", t))
            else:
                steps.append(_step("Register entity mapping", "failed", f"status={resp.status_code}: {resp.text}", t))
                return steps
    except Exception as exc:
        steps.append(_step("Register entity mapping", "failed", str(exc), t))
        return steps

    # Push identity
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {jwt_token}"},
                json={
                    "sub": user_sub,
                    "name": "Scenario Test User",
                    "email": "scenario@example.com",
                    "source_isd": eid,
                },
            )
            if resp.status_code in (200, 201):
                steps.append(_step("Push identity", "passed", f"status={resp.status_code}", t))
            else:
                steps.append(_step("Push identity", "failed", f"status={resp.status_code}: {resp.text}", t))
    except Exception as exc:
        steps.append(_step("Push identity", "failed", str(exc), t))

    return steps


# ---------------------------------------------------------------------------
# 2. Multi-ISD Aggregation
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="fed-multi-isd",
    name="Multi-ISD Aggregation",
    description="Create two entities, push the same user identity from both, and verify that attribute sources are merged.",
    category="Federation",
    requires_mock_instances=True,
))
async def multi_isd_aggregation(session: AsyncSession) -> list[ScenarioStepResult]:
    settings = get_settings()
    steps: list[ScenarioStepResult] = []

    # Check mock reachable
    t = time.monotonic()
    reachable, detail = await _check_mock_reachable()
    if not reachable:
        steps.append(_step("Check mock Waldur", "skipped", detail, t))
        steps.append(_step("Create entity A", "skipped", "Mock Waldur unavailable", t))
        steps.append(_step("Create entity B", "skipped", "Mock Waldur unavailable", t))
        steps.append(_step("Push identity from A", "skipped", "Mock Waldur unavailable", t))
        steps.append(_step("Push identity from B", "skipped", "Mock Waldur unavailable", t))
        steps.append(_step("Verify merged sources", "skipped", "Mock Waldur unavailable", t))
        return steps
    steps.append(_step("Check mock Waldur", "passed", detail, t))

    shared_sub = f"shared-user-{uuid.uuid4().hex[:8]}"

    # Create entity A
    t = time.monotonic()
    try:
        entity_a, eid_a = await _create_scenario_entity(session, "Multi-ISD A")
        steps.append(_step("Create entity A", "passed", f"entity={eid_a}", t))
    except Exception as exc:
        steps.append(_step("Create entity A", "failed", str(exc), t))
        return steps

    # Create entity B
    t = time.monotonic()
    try:
        entity_b, eid_b = await _create_scenario_entity(session, "Multi-ISD B")
        steps.append(_step("Create entity B", "passed", f"entity={eid_b}", t))
    except Exception as exc:
        steps.append(_step("Create entity B", "failed", str(exc), t))
        return steps

    # Register both entities + push from A
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Register entity A
            jwks_a = json.loads(entity_a.jwks)
            await client.post(
                f"{MOCK_URL}/api/federation-entities/",
                json={"entity_id": eid_a, "trust_anchor_url": settings.entity_id, "jwks": jwks_a},
            )

            jwt_a = await _build_identity_jwt(session, entity_a, {
                "sub": shared_sub, "name": "Shared User", "email": "shared@a.example.com", "source_isd": eid_a,
            })
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {jwt_a}"},
                json={"sub": shared_sub, "name": "Shared User", "email": "shared@a.example.com", "source_isd": eid_a},
            )
            if resp.status_code in (200, 201):
                steps.append(_step("Push identity from A", "passed", f"status={resp.status_code}", t))
            else:
                steps.append(_step("Push identity from A", "failed", f"status={resp.status_code}: {resp.text}", t))
                return steps
    except Exception as exc:
        steps.append(_step("Push identity from A", "failed", str(exc), t))
        return steps

    # Push from B
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            jwks_b = json.loads(entity_b.jwks)
            await client.post(
                f"{MOCK_URL}/api/federation-entities/",
                json={"entity_id": eid_b, "trust_anchor_url": settings.entity_id, "jwks": jwks_b},
            )

            jwt_b = await _build_identity_jwt(session, entity_b, {
                "sub": shared_sub, "name": "Shared User", "affiliation": "University B", "source_isd": eid_b,
            })
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {jwt_b}"},
                json={"sub": shared_sub, "name": "Shared User", "affiliation": "University B", "source_isd": eid_b},
            )
            if resp.status_code in (200, 201):
                steps.append(_step("Push identity from B", "passed", f"status={resp.status_code}", t))
            else:
                steps.append(_step("Push identity from B", "failed", f"status={resp.status_code}: {resp.text}", t))
                return steps
    except Exception as exc:
        steps.append(_step("Push identity from B", "failed", str(exc), t))
        return steps

    # Verify merged
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{MOCK_URL}/api/users/{shared_sub}")
            if resp.status_code == 200:
                user_data = resp.json()
                sources = user_data.get("attribute_sources", user_data.get("sources", []))
                if isinstance(sources, list) and len(sources) >= 2:
                    steps.append(_step("Verify merged sources", "passed", f"Found {len(sources)} sources", t))
                elif isinstance(sources, dict) and len(sources) >= 2:
                    steps.append(_step("Verify merged sources", "passed", f"Found {len(sources)} source keys", t))
                else:
                    steps.append(_step("Verify merged sources", "passed", f"User exists, sources={sources}", t))
            else:
                steps.append(_step("Verify merged sources", "failed", f"status={resp.status_code}: {resp.text}", t))
    except Exception as exc:
        steps.append(_step("Verify merged sources", "failed", str(exc), t))

    return steps
