"""Federation scenarios — require running mock Waldur instances."""

import json
import time
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus
from app.core.models.signing_key import KeyAlgorithm
from app.keys.manager import generate_key, get_active_key, get_entity_jwks
from app.scenarios import register
from app.scenarios.schemas import ScenarioMeta, ScenarioStepResult

MOCK_URL = "http://localhost:9501"


def _entity_id() -> str:
    return f"https://scenario-{uuid.uuid4().hex[:12]}.example.com"


def _isd_source() -> str:
    return f"scenario-isd-{uuid.uuid4().hex[:8]}"


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
    """Helper: create and activate a scenario entity with keys + subordinate statement."""
    from datetime import datetime, timedelta
    from sqlalchemy import select
    from app.core.models.entity import SubordinateStatement
    from app.federation.jwt_builder import build_subordinate_statement

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

    # Issue subordinate statement so the TA fetch endpoint can serve this entity's JWKS
    ta_result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    ta = ta_result.scalars().first()
    if ta:
        ta_key = await get_active_key(session, ta.id)
        if ta_key:
            jwt_token = build_subordinate_statement(
                issuer_entity_id=settings.entity_id,
                subject_entity_id=eid,
                signing_key=ta_key,
                subject_jwks=jwks,
            )
            now = datetime.utcnow()
            stmt = SubordinateStatement(
                issuer_id=ta.id,
                subject_id=entity.id,
                issuer_entity_id=settings.entity_id,
                subject_entity_id=eid,
                issued_at=now,
                expires_at=now + timedelta(seconds=settings.default_statement_lifetime_seconds),
                jwt=jwt_token,
                is_current=True,
            )
            session.add(stmt)
            await session.commit()

    return entity, eid


async def _build_identity_jwt(session: AsyncSession, entity: Entity, user_claims: dict) -> str:
    """Build a signed identity JWT for pushing to mock Waldur."""
    from authlib.jose import JsonWebKey, jwt as jose_jwt
    from app.keys.manager import get_private_key_pem

    key = await get_active_key(session, entity.id)
    assert key, "Entity has no active key"

    pem = get_private_key_pem(key)
    private_key = JsonWebKey.import_key(pem, {"kty": "EC" if "ES" in key.algorithm else "RSA"})

    now = int(time.time())
    header = {"alg": key.algorithm, "kid": key.kid, "typ": "JWT"}
    payload = {
        "iss": entity.entity_id,
        "sub": user_claims.get("username", f"user-{uuid.uuid4().hex[:8]}"),
        "iat": now,
        "exp": now + 300,
        **user_claims,
    }
    return jose_jwt.encode(header, payload, private_key).decode()


TA_URL = "http://localhost:9000"


async def _register_entity_mapping(
    client: httpx.AsyncClient, eid: str, isd_source: str
) -> tuple[bool, str]:
    """Register a federation entity mapping in mock Waldur. Returns (ok, detail)."""
    resp = await client.post(
        f"{MOCK_URL}/api/federation-entities/",
        json={
            "entity_id": eid,
            "isd_source": isd_source,
            "trust_anchor_url": TA_URL,
        },
    )
    if resp.status_code in (200, 201):
        return True, f"status={resp.status_code}, isd_source={isd_source}"
    if resp.status_code == 409:
        return True, "Already registered"
    return False, f"status={resp.status_code}: {resp.text}"


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

    isd = _isd_source()
    username = f"scenario-user-{uuid.uuid4().hex[:8]}"

    # Build identity JWT
    t = time.monotonic()
    try:
        jwt_token = await _build_identity_jwt(session, entity, {
            "username": username,
        })
        assert len(jwt_token) > 50
        steps.append(_step("Build identity JWT", "passed", f"JWT length={len(jwt_token)}", t))
    except Exception as exc:
        steps.append(_step("Build identity JWT", "failed", str(exc), t))
        return steps

    # Register entity mapping in mock Waldur
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ok, detail = await _register_entity_mapping(client, eid, isd)
            if ok:
                steps.append(_step("Register entity mapping", "passed", detail, t))
            else:
                steps.append(_step("Register entity mapping", "failed", detail, t))
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
                    "username": username,
                    "first_name": "Scenario",
                    "last_name": "Test User",
                    "email": "scenario@example.com",
                    "organization": "Scenario Org",
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

    shared_username = f"shared-user-{uuid.uuid4().hex[:8]}"
    isd_a = _isd_source()
    isd_b = _isd_source()

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
            ok, detail = await _register_entity_mapping(client, eid_a, isd_a)
            if not ok:
                steps.append(_step("Push identity from A", "failed", f"Register failed: {detail}", t))
                return steps

            jwt_a = await _build_identity_jwt(session, entity_a, {
                "username": shared_username,
            })
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {jwt_a}"},
                json={
                    "username": shared_username,
                    "first_name": "Shared",
                    "last_name": "User",
                    "email": "shared@a.example.com",
                    "organization": "Org A",
                },
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
            ok, detail = await _register_entity_mapping(client, eid_b, isd_b)
            if not ok:
                steps.append(_step("Push identity from B", "failed", f"Register failed: {detail}", t))
                return steps

            jwt_b = await _build_identity_jwt(session, entity_b, {
                "username": shared_username,
            })
            resp = await client.post(
                f"{MOCK_URL}/api/identity-bridge/",
                headers={"Authorization": f"Bearer {jwt_b}"},
                json={
                    "username": shared_username,
                    "first_name": "Shared",
                    "last_name": "User",
                    "organization": "Org B",
                    "country": "DE",
                },
            )
            if resp.status_code in (200, 201):
                steps.append(_step("Push identity from B", "passed", f"status={resp.status_code}", t))
            else:
                steps.append(_step("Push identity from B", "failed", f"status={resp.status_code}: {resp.text}", t))
                return steps
    except Exception as exc:
        steps.append(_step("Push identity from B", "failed", str(exc), t))
        return steps

    # Verify merged — list users filtered by username, check active_isds
    t = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{MOCK_URL}/api/users/")
            if resp.status_code == 200:
                users = resp.json()
                user = next((u for u in users if u["username"] == shared_username), None)
                if user:
                    active_isds = user.get("active_isds", [])
                    if len(active_isds) >= 2:
                        steps.append(_step("Verify merged sources", "passed", f"active_isds={active_isds}", t))
                    else:
                        steps.append(_step("Verify merged sources", "failed", f"Expected 2+ ISDs, got {active_isds}", t))
                else:
                    steps.append(_step("Verify merged sources", "failed", f"User '{shared_username}' not found in list", t))
            else:
                steps.append(_step("Verify merged sources", "failed", f"status={resp.status_code}: {resp.text}", t))
    except Exception as exc:
        steps.append(_step("Verify merged sources", "failed", str(exc), t))

    return steps
