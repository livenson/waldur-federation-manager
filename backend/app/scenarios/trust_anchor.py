"""Trust Anchor scenarios — always work, DB-only operations."""

import json
import time
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus, SubordinateStatement
from app.core.models.signing_key import KeyAlgorithm, KeyStatus, SigningKey
from app.core.models.trust_mark import TrustMark, TrustMarkDefinition, TrustMarkStatus
from app.core.models.waldur_instance import WaldurInstance
from app.federation.jwt_builder import build_subordinate_statement, build_trust_mark_jwt
from app.keys.manager import generate_key, get_active_key, get_entity_jwks, rotate_key
from app.scenarios import register
from app.scenarios.schemas import ScenarioMeta, ScenarioStepResult


def _entity_id() -> str:
    return f"https://scenario-{uuid.uuid4().hex[:12]}.example.com"


def _step(name: str, status: str, detail: str, start: float) -> ScenarioStepResult:
    return ScenarioStepResult(
        name=name,
        status=status,
        detail=detail,
        duration_ms=round((time.monotonic() - start) * 1000, 1),
    )


# ---------------------------------------------------------------------------
# 1. Register & Activate Entity
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="ta-register-activate",
    name="Register & Activate Entity",
    description="Create an entity, activate it, and verify that a subordinate statement and signing key are generated.",
    category="Trust Anchor",
))
async def register_activate(session: AsyncSession) -> list[ScenarioStepResult]:
    settings = get_settings()
    steps: list[ScenarioStepResult] = []
    eid = _entity_id()

    # Step 1 — Create entity
    t = time.monotonic()
    try:
        entity = Entity(
            entity_id=eid,
            name="[Scenario] Register & Activate",
            organization="Scenario Test",
            entity_types=json.dumps(["federation_entity"]),
            status=EntityStatus.DRAFT,
        )
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        steps.append(_step("Create entity", "passed", f"Created {eid}", t))
    except Exception as exc:
        steps.append(_step("Create entity", "failed", str(exc), t))
        return steps

    # Step 2 — Generate signing key
    t = time.monotonic()
    try:
        algo = KeyAlgorithm(settings.default_key_algorithm)
        key = await generate_key(session, entity.id, algo)
        jwks = await get_entity_jwks(session, entity.id)
        entity.jwks = json.dumps(jwks)
        session.add(entity)
        await session.commit()
        steps.append(_step("Generate signing key", "passed", f"kid={key.kid}", t))
    except Exception as exc:
        steps.append(_step("Generate signing key", "failed", str(exc), t))
        return steps

    # Step 3 — Activate
    t = time.monotonic()
    try:
        entity.status = EntityStatus.ACTIVE
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        assert entity.status == EntityStatus.ACTIVE
        steps.append(_step("Activate entity", "passed", "Status → active", t))
    except Exception as exc:
        steps.append(_step("Activate entity", "failed", str(exc), t))
        return steps

    # Step 4 — Issue subordinate statement
    t = time.monotonic()
    try:
        ta_result = await session.execute(
            select(Entity).where(Entity.entity_id == settings.entity_id)
        )
        ta = ta_result.scalars().first()
        assert ta, "Trust Anchor entity not found"
        ta_key = await get_active_key(session, ta.id)
        assert ta_key, "Trust Anchor has no active key"

        subject_jwks = json.loads(entity.jwks) if entity.jwks else {}
        jwt_token = build_subordinate_statement(
            issuer_entity_id=settings.entity_id,
            subject_entity_id=entity.entity_id,
            signing_key=ta_key,
            subject_jwks=subject_jwks,
        )
        assert jwt_token and len(jwt_token) > 50
        steps.append(_step("Issue subordinate statement", "passed", f"JWT length={len(jwt_token)}", t))
    except Exception as exc:
        steps.append(_step("Issue subordinate statement", "failed", str(exc), t))
        return steps

    # Step 5 — Verify entity key in JWKS
    t = time.monotonic()
    try:
        active_key = await get_active_key(session, entity.id)
        assert active_key, "No active key found"
        assert active_key.status == KeyStatus.ACTIVE
        steps.append(_step("Verify signing key", "passed", f"Active key kid={active_key.kid}", t))
    except Exception as exc:
        steps.append(_step("Verify signing key", "failed", str(exc), t))

    return steps


# ---------------------------------------------------------------------------
# 2. Entity Lifecycle
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="ta-entity-lifecycle",
    name="Entity Lifecycle",
    description="Walk an entity through the full lifecycle: create → activate → suspend → reactivate → revoke.",
    category="Trust Anchor",
))
async def entity_lifecycle(session: AsyncSession) -> list[ScenarioStepResult]:
    steps: list[ScenarioStepResult] = []
    eid = _entity_id()
    settings = get_settings()

    # Create
    t = time.monotonic()
    try:
        entity = Entity(
            entity_id=eid,
            name="[Scenario] Lifecycle",
            organization="Scenario Test",
            entity_types=json.dumps(["federation_entity"]),
            status=EntityStatus.DRAFT,
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
        steps.append(_step("Create entity (draft)", "passed", f"Created {eid}", t))
    except Exception as exc:
        steps.append(_step("Create entity (draft)", "failed", str(exc), t))
        return steps

    # Activate
    t = time.monotonic()
    try:
        entity.status = EntityStatus.ACTIVE
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        assert entity.status == EntityStatus.ACTIVE
        steps.append(_step("Activate", "passed", "Status → active", t))
    except Exception as exc:
        steps.append(_step("Activate", "failed", str(exc), t))
        return steps

    # Suspend
    t = time.monotonic()
    try:
        entity.status = EntityStatus.SUSPENDED
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        assert entity.status == EntityStatus.SUSPENDED
        steps.append(_step("Suspend", "passed", "Status → suspended", t))
    except Exception as exc:
        steps.append(_step("Suspend", "failed", str(exc), t))
        return steps

    # Reactivate
    t = time.monotonic()
    try:
        entity.status = EntityStatus.ACTIVE
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        assert entity.status == EntityStatus.ACTIVE
        steps.append(_step("Reactivate", "passed", "Status → active", t))
    except Exception as exc:
        steps.append(_step("Reactivate", "failed", str(exc), t))
        return steps

    # Revoke
    t = time.monotonic()
    try:
        entity.status = EntityStatus.REVOKED
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        assert entity.status == EntityStatus.REVOKED
        steps.append(_step("Revoke", "passed", "Status → revoked", t))
    except Exception as exc:
        steps.append(_step("Revoke", "failed", str(exc), t))

    return steps


# ---------------------------------------------------------------------------
# 3. Key Rotation
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="ta-key-rotation",
    name="Key Rotation",
    description="Create and activate an entity, rotate its signing key, and verify the old key is ROTATED while the new key is ACTIVE.",
    category="Trust Anchor",
))
async def key_rotation(session: AsyncSession) -> list[ScenarioStepResult]:
    steps: list[ScenarioStepResult] = []
    eid = _entity_id()
    settings = get_settings()
    algo = KeyAlgorithm(settings.default_key_algorithm)

    # Create + activate
    t = time.monotonic()
    try:
        entity = Entity(
            entity_id=eid,
            name="[Scenario] Key Rotation",
            organization="Scenario Test",
            entity_types=json.dumps(["federation_entity"]),
            status=EntityStatus.ACTIVE,
        )
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        original_key = await generate_key(session, entity.id, algo)
        jwks = await get_entity_jwks(session, entity.id)
        entity.jwks = json.dumps(jwks)
        session.add(entity)
        await session.commit()
        steps.append(_step("Create entity with key", "passed", f"kid={original_key.kid}", t))
    except Exception as exc:
        steps.append(_step("Create entity with key", "failed", str(exc), t))
        return steps

    original_kid = original_key.kid

    # Rotate
    t = time.monotonic()
    try:
        new_key = await rotate_key(session, entity.id, algo)
        assert new_key.kid != original_kid
        steps.append(_step("Rotate key", "passed", f"New kid={new_key.kid}", t))
    except Exception as exc:
        steps.append(_step("Rotate key", "failed", str(exc), t))
        return steps

    # Verify old key is ROTATED
    t = time.monotonic()
    try:
        result = await session.execute(
            select(SigningKey).where(SigningKey.kid == original_kid)
        )
        old_key = result.scalars().first()
        assert old_key, "Original key not found"
        assert old_key.status == KeyStatus.ROTATED, f"Expected ROTATED, got {old_key.status}"
        steps.append(_step("Verify old key rotated", "passed", f"kid={original_kid} status=rotated", t))
    except Exception as exc:
        steps.append(_step("Verify old key rotated", "failed", str(exc), t))

    # Verify new key is ACTIVE
    t = time.monotonic()
    try:
        active = await get_active_key(session, entity.id)
        assert active, "No active key found"
        assert active.kid == new_key.kid
        steps.append(_step("Verify new key active", "passed", f"kid={active.kid} status=active", t))
    except Exception as exc:
        steps.append(_step("Verify new key active", "failed", str(exc), t))

    # Verify JWKS has only the new key
    t = time.monotonic()
    try:
        jwks = await get_entity_jwks(session, entity.id)
        kids = [k["kid"] for k in jwks["keys"]]
        assert new_key.kid in kids
        assert original_kid not in kids
        steps.append(_step("Verify JWKS updated", "passed", f"JWKS keys: {kids}", t))
    except Exception as exc:
        steps.append(_step("Verify JWKS updated", "failed", str(exc), t))

    return steps


# ---------------------------------------------------------------------------
# 4. Trust Mark Lifecycle
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="ta-trust-mark-lifecycle",
    name="Trust Mark Lifecycle",
    description="Create a trust mark definition, issue a trust mark to an entity, verify it is active, then revoke it.",
    category="Trust Anchor",
))
async def trust_mark_lifecycle(session: AsyncSession) -> list[ScenarioStepResult]:
    steps: list[ScenarioStepResult] = []
    settings = get_settings()
    eid = _entity_id()
    tm_id = f"https://scenario-trustmark-{uuid.uuid4().hex[:8]}.example.com"

    # Create trust mark definition
    t = time.monotonic()
    try:
        definition = TrustMarkDefinition(
            trust_mark_id=tm_id,
            name="[Scenario] GDPR Compliance",
            description="Scenario test trust mark",
        )
        session.add(definition)
        await session.commit()
        await session.refresh(definition)
        steps.append(_step("Create trust mark definition", "passed", f"id={tm_id}", t))
    except Exception as exc:
        steps.append(_step("Create trust mark definition", "failed", str(exc), t))
        return steps

    # Create + activate entity
    t = time.monotonic()
    try:
        entity = Entity(
            entity_id=eid,
            name="[Scenario] Trust Mark Target",
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
        steps.append(_step("Create + activate entity", "passed", f"entity={eid}", t))
    except Exception as exc:
        steps.append(_step("Create + activate entity", "failed", str(exc), t))
        return steps

    # Issue trust mark
    t = time.monotonic()
    try:
        ta_result = await session.execute(
            select(Entity).where(Entity.entity_id == settings.entity_id)
        )
        ta = ta_result.scalars().first()
        assert ta, "Trust Anchor not found"
        ta_key = await get_active_key(session, ta.id)
        assert ta_key, "Trust Anchor has no active key"

        jwt_token = build_trust_mark_jwt(
            issuer_entity_id=settings.entity_id,
            subject_entity_id=eid,
            trust_mark_id=tm_id,
            signing_key=ta_key,
        )
        trust_mark = TrustMark(
            definition_id=definition.id,
            subject_id=entity.id,
            issuer_id=ta.id,
            subject_entity_id=eid,
            trust_mark_id=tm_id,
            jwt=jwt_token,
            status=TrustMarkStatus.ACTIVE,
        )
        session.add(trust_mark)
        await session.commit()
        await session.refresh(trust_mark)
        steps.append(_step("Issue trust mark", "passed", f"JWT length={len(jwt_token)}", t))
    except Exception as exc:
        steps.append(_step("Issue trust mark", "failed", str(exc), t))
        return steps

    # Verify active
    t = time.monotonic()
    try:
        assert trust_mark.status == TrustMarkStatus.ACTIVE
        steps.append(_step("Verify trust mark active", "passed", "status=active", t))
    except Exception as exc:
        steps.append(_step("Verify trust mark active", "failed", str(exc), t))

    # Revoke
    t = time.monotonic()
    try:
        trust_mark.status = TrustMarkStatus.REVOKED
        trust_mark.revocation_reason = "Scenario test revocation"
        session.add(trust_mark)
        await session.commit()
        await session.refresh(trust_mark)
        assert trust_mark.status == TrustMarkStatus.REVOKED
        steps.append(_step("Revoke trust mark", "passed", "status=revoked", t))
    except Exception as exc:
        steps.append(_step("Revoke trust mark", "failed", str(exc), t))

    return steps


# ---------------------------------------------------------------------------
# 5. Instance Lifecycle
# ---------------------------------------------------------------------------

@register(ScenarioMeta(
    id="ta-instance-lifecycle",
    name="Instance Lifecycle",
    description="Register a Waldur instance, verify it appears in the list, then delete it and verify removal.",
    category="Trust Anchor",
))
async def instance_lifecycle(session: AsyncSession) -> list[ScenarioStepResult]:
    steps: list[ScenarioStepResult] = []
    instance_url = f"https://scenario-instance-{uuid.uuid4().hex[:8]}.example.com"

    # Create instance
    t = time.monotonic()
    try:
        instance = WaldurInstance(
            name="[Scenario] Test Instance",
            base_url=instance_url,
        )
        session.add(instance)
        await session.commit()
        await session.refresh(instance)
        steps.append(_step("Create instance", "passed", f"url={instance_url}", t))
    except Exception as exc:
        steps.append(_step("Create instance", "failed", str(exc), t))
        return steps

    # Verify in list
    t = time.monotonic()
    try:
        result = await session.execute(
            select(WaldurInstance).where(WaldurInstance.base_url == instance_url)
        )
        found = result.scalars().first()
        assert found, "Instance not found in database"
        assert found.name == "[Scenario] Test Instance"
        steps.append(_step("Verify instance in list", "passed", f"Found id={found.id}", t))
    except Exception as exc:
        steps.append(_step("Verify instance in list", "failed", str(exc), t))
        return steps

    # Delete
    t = time.monotonic()
    try:
        await session.delete(instance)
        await session.commit()
        steps.append(_step("Delete instance", "passed", "Deleted successfully", t))
    except Exception as exc:
        steps.append(_step("Delete instance", "failed", str(exc), t))
        return steps

    # Verify gone
    t = time.monotonic()
    try:
        result = await session.execute(
            select(WaldurInstance).where(WaldurInstance.base_url == instance_url)
        )
        gone = result.scalars().first()
        assert gone is None, "Instance still exists after deletion"
        steps.append(_step("Verify instance removed", "passed", "Not found — confirmed deleted", t))
    except Exception as exc:
        steps.append(_step("Verify instance removed", "failed", str(exc), t))

    return steps
