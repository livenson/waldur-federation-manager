"""Federation topology API — instance registration and topology graph."""

import asyncio
import logging
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models.waldur_instance import InstanceStatus, WaldurInstance
from app.core.schemas.topology import (
    FederationEntityInfo,
    InstanceHealth,
    TopologyEdge,
    TopologyNode,
    TopologyResponse,
    TopologySummary,
    WaldurInstanceCreate,
    WaldurInstanceResponse,
)
from app.database import get_session
from app.notifications.notifier import notify_instances

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/topology", tags=["Topology"])

QUERY_TIMEOUT = 5.0  # seconds


# ---------------------------------------------------------------------------
# Instance CRUD
# ---------------------------------------------------------------------------


@router.post("/instances", response_model=WaldurInstanceResponse, status_code=201)
async def create_instance(
    data: WaldurInstanceCreate,
    session: AsyncSession = Depends(get_session),
) -> WaldurInstanceResponse:
    """Register a Waldur instance."""
    base_url = data.base_url.rstrip("/")

    existing = await session.execute(
        select(WaldurInstance).where(WaldurInstance.base_url == base_url)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Instance with this base_url already exists")

    instance = WaldurInstance(name=data.name, base_url=base_url)
    session.add(instance)
    await session.commit()
    await session.refresh(instance)

    await notify_instances(
        session, "instance.added", {"instance_name": instance.name, "base_url": instance.base_url}
    )

    return WaldurInstanceResponse.model_validate(instance)


@router.get("/instances", response_model=list[WaldurInstanceResponse])
async def list_instances(
    session: AsyncSession = Depends(get_session),
) -> list[WaldurInstanceResponse]:
    """List all registered Waldur instances."""
    result = await session.execute(
        select(WaldurInstance).order_by(WaldurInstance.created_at.desc())
    )
    return [WaldurInstanceResponse.model_validate(i) for i in result.scalars().all()]


@router.delete("/instances/{instance_id}", status_code=204)
async def delete_instance(
    instance_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Remove a Waldur instance."""
    result = await session.execute(
        select(WaldurInstance).where(WaldurInstance.id == instance_id)
    )
    instance = result.scalars().first()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    instance_name = instance.name
    instance_base_url = instance.base_url

    await session.delete(instance)
    await session.commit()

    await notify_instances(
        session, "instance.removed", {"instance_name": instance_name, "base_url": instance_base_url}
    )


# ---------------------------------------------------------------------------
# Instance querying helpers
# ---------------------------------------------------------------------------


async def _query_instance(client: httpx.AsyncClient, instance: WaldurInstance) -> InstanceHealth:
    """Query a single Waldur instance for health, federation entities, and users."""
    base = instance.base_url.rstrip("/")
    status = "unreachable"
    trust_anchor_urls: list[str] = []
    entity_count = 0
    user_count = 0
    federation_entities: list[FederationEntityInfo] = []

    try:
        # Health endpoint
        health_resp = await client.get(f"{base}/health-check/")
        if health_resp.status_code == 200:
            status = "healthy"
        else:
            status = "unhealthy"
    except Exception:
        status = "unreachable"

    # Federation entities
    try:
        fe_resp = await client.get(f"{base}/api/federation-entities/")
        if fe_resp.status_code == 200:
            fe_data = fe_resp.json()
            items = fe_data if isinstance(fe_data, list) else fe_data.get("results", [])
            entity_count = len(items)
            for item in items:
                entity_id = item.get("entity_id", item.get("url", ""))
                ta_url = item.get("trust_anchor_url", item.get("trust_anchor", ""))
                if ta_url and ta_url not in trust_anchor_urls:
                    trust_anchor_urls.append(ta_url)
                federation_entities.append(
                    FederationEntityInfo(
                        entity_id=entity_id,
                        isd_source=item.get("isd_source"),
                        trust_anchor_url=ta_url if ta_url else None,
                        is_active=item.get("is_active", True),
                    )
                )
    except Exception:
        pass

    # Users
    try:
        users_resp = await client.get(f"{base}/api/users/")
        if users_resp.status_code == 200:
            users_data = users_resp.json()
            if isinstance(users_data, list):
                user_count = len(users_data)
            elif isinstance(users_data, dict):
                user_count = users_data.get("count", len(users_data.get("results", [])))
    except Exception:
        pass

    return InstanceHealth(
        instance_id=instance.id,
        name=instance.name,
        base_url=base,
        status=status,
        trust_anchor_urls=trust_anchor_urls,
        entity_count=entity_count,
        user_count=user_count,
        federation_entities=federation_entities,
    )


# ---------------------------------------------------------------------------
# Topology aggregation
# ---------------------------------------------------------------------------


@router.get("/", response_model=TopologyResponse)
async def get_topology(
    session: AsyncSession = Depends(get_session),
) -> TopologyResponse:
    """Full federation topology: instances, graph nodes/edges, and summary."""
    result = await session.execute(select(WaldurInstance))
    instances = list(result.scalars().all())

    if not instances:
        return TopologyResponse()

    # Query all instances concurrently
    async with httpx.AsyncClient(timeout=QUERY_TIMEOUT) as client:
        health_results = await asyncio.gather(
            *[_query_instance(client, inst) for inst in instances],
            return_exceptions=True,
        )

    instance_healths: list[InstanceHealth] = []
    for inst, res in zip(instances, health_results):
        if isinstance(res, Exception):
            logger.warning("Failed to query instance %s: %s", inst.name, res)
            ih = InstanceHealth(
                instance_id=inst.id,
                name=inst.name,
                base_url=inst.base_url,
                status="unreachable",
            )
        else:
            ih = res
        instance_healths.append(ih)

        # Update instance status in DB
        new_status = (
            InstanceStatus.HEALTHY if ih.status == "healthy"
            else InstanceStatus.UNHEALTHY if ih.status == "unhealthy"
            else InstanceStatus.UNKNOWN
        )
        inst.status = new_status
        inst.last_seen_at = datetime.utcnow() if ih.status == "healthy" else inst.last_seen_at
        inst.updated_at = datetime.utcnow()
        session.add(inst)

    await session.commit()

    # Build graph nodes and edges
    nodes: list[TopologyNode] = []
    edges: list[TopologyEdge] = []
    seen_anchors: set[str] = set()

    # Deduplicate trust anchors
    for ih in instance_healths:
        for ta_url in ih.trust_anchor_urls:
            if ta_url not in seen_anchors:
                seen_anchors.add(ta_url)
                nodes.append(TopologyNode(
                    id=f"ta-{ta_url}",
                    type="trust_anchor",
                    label=ta_url,
                    data={"url": ta_url},
                ))

    # Instance nodes + edges
    for ih in instance_healths:
        node_id = f"inst-{ih.instance_id}"
        nodes.append(TopologyNode(
            id=node_id,
            type="waldur_instance",
            label=ih.name,
            data={
                "base_url": ih.base_url,
                "status": ih.status,
                "entity_count": ih.entity_count,
                "user_count": ih.user_count,
            },
        ))
        for ta_url in ih.trust_anchor_urls:
            edges.append(TopologyEdge(
                id=f"edge-{ih.instance_id}-{ta_url}",
                source=node_id,
                target=f"ta-{ta_url}",
                type="trusts",
            ))

    # Summary
    healthy_count = sum(1 for ih in instance_healths if ih.status == "healthy")
    total_fed_entities = sum(ih.entity_count for ih in instance_healths)
    total_users = sum(ih.user_count for ih in instance_healths)

    summary = TopologySummary(
        total_instances=len(instances),
        healthy_instances=healthy_count,
        total_federations=len(seen_anchors),
        total_federation_entities=total_fed_entities,
        total_users=total_users,
    )

    return TopologyResponse(
        instances=instance_healths,
        nodes=nodes,
        edges=edges,
        summary=summary,
    )


@router.get("/summary", response_model=TopologySummary)
async def get_topology_summary(
    session: AsyncSession = Depends(get_session),
) -> TopologySummary:
    """Lightweight topology summary."""
    result = await session.execute(select(WaldurInstance))
    instances = list(result.scalars().all())

    if not instances:
        return TopologySummary()

    async with httpx.AsyncClient(timeout=QUERY_TIMEOUT) as client:
        health_results = await asyncio.gather(
            *[_query_instance(client, inst) for inst in instances],
            return_exceptions=True,
        )

    healthy = 0
    anchors: set[str] = set()
    total_entities = 0
    total_users = 0

    for res in health_results:
        if isinstance(res, Exception):
            continue
        if res.status == "healthy":
            healthy += 1
        anchors.update(res.trust_anchor_urls)
        total_entities += res.entity_count
        total_users += res.user_count

    return TopologySummary(
        total_instances=len(instances),
        healthy_instances=healthy,
        total_federations=len(anchors),
        total_federation_entities=total_entities,
        total_users=total_users,
    )
