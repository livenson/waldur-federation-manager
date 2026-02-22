"""Metadata policy management API."""

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models.entity import Entity
from app.core.models.metadata_policy import MetadataPolicy
from app.core.schemas.policy import (
    EntityComplianceResult,
    PolicyCreate,
    PolicyEvaluationResponse,
    PolicyListResponse,
    PolicyResponse,
    PolicyUpdate,
)
from app.database import get_session
from app.exceptions import MetadataPolicyError
from app.federation.metadata_policy import apply_policy

router = APIRouter(prefix="/api/policies", tags=["Policy Management"])


def _policy_to_response(policy: MetadataPolicy) -> PolicyResponse:
    return PolicyResponse(
        id=policy.id,
        name=policy.name,
        description=policy.description,
        entity_type=policy.entity_type,
        policy=json.loads(policy.policy) if policy.policy else {},
        created_at=policy.created_at,
        updated_at=policy.updated_at,
    )


@router.post("/", response_model=PolicyResponse, status_code=201)
async def create_policy(
    data: PolicyCreate,
    session: AsyncSession = Depends(get_session),
) -> PolicyResponse:
    """Create a new metadata policy."""
    existing = await session.execute(
        select(MetadataPolicy).where(MetadataPolicy.name == data.name)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Policy with this name already exists")

    policy = MetadataPolicy(
        name=data.name,
        description=data.description,
        entity_type=data.entity_type,
        policy=json.dumps(data.policy),
    )
    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return _policy_to_response(policy)


@router.get("/", response_model=PolicyListResponse)
async def list_policies(
    entity_type: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> PolicyListResponse:
    """List metadata policies."""
    query = select(MetadataPolicy)
    count_query = select(func.count()).select_from(MetadataPolicy)

    if entity_type:
        query = query.where(MetadataPolicy.entity_type == entity_type)
        count_query = count_query.where(MetadataPolicy.entity_type == entity_type)

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(skip).limit(limit).order_by(MetadataPolicy.created_at.desc())
    result = await session.execute(query)
    policies = result.scalars().all()

    return PolicyListResponse(
        policies=[_policy_to_response(p) for p in policies],
        total=total,
    )


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(
    policy_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> PolicyResponse:
    """Get a policy by ID."""
    result = await session.execute(
        select(MetadataPolicy).where(MetadataPolicy.id == policy_id)
    )
    policy = result.scalars().first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return _policy_to_response(policy)


@router.patch("/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: uuid.UUID,
    data: PolicyUpdate,
    session: AsyncSession = Depends(get_session),
) -> PolicyResponse:
    """Update a metadata policy."""
    result = await session.execute(
        select(MetadataPolicy).where(MetadataPolicy.id == policy_id)
    )
    policy = result.scalars().first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    if data.name is not None:
        policy.name = data.name
    if data.description is not None:
        policy.description = data.description
    if data.entity_type is not None:
        policy.entity_type = data.entity_type
    if data.policy is not None:
        policy.policy = json.dumps(data.policy)

    policy.updated_at = datetime.utcnow()
    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return _policy_to_response(policy)


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(
    policy_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a metadata policy."""
    result = await session.execute(
        select(MetadataPolicy).where(MetadataPolicy.id == policy_id)
    )
    policy = result.scalars().first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    await session.delete(policy)
    await session.commit()


@router.post("/{policy_id}/evaluate", response_model=PolicyEvaluationResponse)
async def evaluate_policy(
    policy_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> PolicyEvaluationResponse:
    """Evaluate a policy against all matching entities."""
    result = await session.execute(
        select(MetadataPolicy).where(MetadataPolicy.id == policy_id)
    )
    policy = result.scalars().first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    policy_dict = json.loads(policy.policy) if policy.policy else {}

    # Find entities whose entity_types JSON list contains this policy's entity_type
    entity_result = await session.execute(select(Entity))
    all_entities = entity_result.scalars().all()
    matching = [
        e for e in all_entities
        if policy.entity_type in json.loads(e.entity_types)
    ]

    results: list[EntityComplianceResult] = []
    compliant_count = 0
    non_compliant_count = 0

    for entity in matching:
        entity_metadata = json.loads(entity.entity_metadata)
        full_policy = {policy.entity_type: policy_dict}
        try:
            apply_policy(entity_metadata, full_policy)
            results.append(EntityComplianceResult(
                entity_id=entity.id,
                entity_name=entity.name,
                entity_url=entity.entity_id,
                status="compliant",
                violations=[],
            ))
            compliant_count += 1
        except MetadataPolicyError as exc:
            results.append(EntityComplianceResult(
                entity_id=entity.id,
                entity_name=entity.name,
                entity_url=entity.entity_id,
                status="non_compliant",
                violations=[exc.message],
            ))
            non_compliant_count += 1
        except Exception as exc:
            results.append(EntityComplianceResult(
                entity_id=entity.id,
                entity_name=entity.name,
                entity_url=entity.entity_id,
                status="error",
                violations=[str(exc)],
            ))
            non_compliant_count += 1

    return PolicyEvaluationResponse(
        policy_id=policy.id,
        policy_name=policy.name,
        entity_type=policy.entity_type,
        total_entities=len(matching),
        compliant=compliant_count,
        non_compliant=non_compliant_count,
        results=results,
    )
