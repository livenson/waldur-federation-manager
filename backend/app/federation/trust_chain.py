"""Trust chain resolution algorithm (OIDC Federation 1.0 Section 10).

Walk from subject entity → authority_hints → trust anchor.
Fetch entity configurations and subordinate statements at each step.
Validate signatures and apply metadata policies.
"""

import json

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models.entity import Entity, EntityStatus, SubordinateStatement
from app.exceptions import TrustChainError
from app.federation.constants import WELL_KNOWN_PATH
from app.federation.jwt_validator import verify_self_signed_jwt, verify_subordinate_statement
from app.federation.metadata_policy import apply_policy, merge_policies


async def resolve_trust_chain(
    session: AsyncSession,
    subject_entity_id: str,
    trust_anchor_entity_id: str | None = None,
    max_depth: int | None = None,
) -> dict:
    """Resolve a trust chain from subject to trust anchor.

    Returns dict with:
      - trust_chain: list of JWT strings (entity config + statements from leaf to anchor)
      - metadata: resolved metadata after policy application
      - subject: subject entity_id
      - anchor: trust anchor entity_id
    """
    settings = get_settings()
    if max_depth is None:
        max_depth = settings.trust_chain_max_depth
    if trust_anchor_entity_id is None:
        trust_anchor_entity_id = settings.entity_id

    # First try local resolution (all entities in our database)
    try:
        return await _resolve_local(
            session, subject_entity_id, trust_anchor_entity_id, max_depth
        )
    except TrustChainError:
        # Fall back to remote resolution
        return await _resolve_remote(
            session, subject_entity_id, trust_anchor_entity_id, max_depth
        )


async def _resolve_local(
    session: AsyncSession,
    subject_entity_id: str,
    anchor_entity_id: str,
    max_depth: int,
) -> dict:
    """Resolve trust chain using only local database entities."""
    # Get subject entity
    result = await session.execute(
        select(Entity).where(
            Entity.entity_id == subject_entity_id,
            Entity.status == EntityStatus.ACTIVE,
        )
    )
    subject = result.scalars().first()
    if not subject:
        raise TrustChainError(f"Subject entity not found or not active: {subject_entity_id}")

    # Get anchor entity
    result = await session.execute(
        select(Entity).where(
            Entity.entity_id == anchor_entity_id,
            Entity.status == EntityStatus.ACTIVE,
        )
    )
    anchor = result.scalars().first()
    if not anchor:
        raise TrustChainError(f"Trust anchor not found or not active: {anchor_entity_id}")

    # Build chain: walk from subject toward anchor via subordinate statements
    chain_jwts: list[str] = []
    accumulated_policy: dict = {}
    current_entity_id = subject_entity_id
    visited: set[str] = set()

    for depth in range(max_depth):
        if current_entity_id == anchor_entity_id:
            break

        if current_entity_id in visited:
            raise TrustChainError(f"Cycle detected at {current_entity_id}")
        visited.add(current_entity_id)

        # Find subordinate statement where this entity is the subject
        stmt_result = await session.execute(
            select(SubordinateStatement).where(
                SubordinateStatement.subject_entity_id == current_entity_id,
                SubordinateStatement.is_current == True,  # noqa: E712
            )
        )
        statement = stmt_result.scalars().first()
        if not statement:
            raise TrustChainError(
                f"No subordinate statement found for subject: {current_entity_id}"
            )

        chain_jwts.append(statement.jwt)

        # Accumulate metadata policy
        if statement.metadata_policy and statement.metadata_policy != "{}":
            stmt_policy = json.loads(statement.metadata_policy)
            accumulated_policy = merge_policies(stmt_policy, accumulated_policy)

        current_entity_id = statement.issuer_entity_id
    else:
        raise TrustChainError(
            f"Trust chain exceeded max depth ({max_depth}) "
            f"without reaching anchor {anchor_entity_id}"
        )

    # Apply accumulated metadata policy to subject's metadata
    subject_metadata = json.loads(subject.entity_metadata) if subject.entity_metadata else {}
    resolved_metadata = subject_metadata
    if accumulated_policy:
        resolved_metadata = apply_policy(subject_metadata, accumulated_policy)

    return {
        "trust_chain": chain_jwts,
        "metadata": resolved_metadata,
        "subject": subject_entity_id,
        "anchor": anchor_entity_id,
    }


async def _resolve_remote(
    session: AsyncSession,
    subject_entity_id: str,
    anchor_entity_id: str,
    max_depth: int,
) -> dict:
    """Resolve trust chain by fetching remote entity configurations.

    This fetches /.well-known/openid-federation from subject,
    follows authority_hints, and fetches subordinate statements.
    """
    chain_jwts: list[str] = []
    accumulated_policy: dict = {}
    current_entity_id = subject_entity_id
    visited: set[str] = set()

    async with httpx.AsyncClient(timeout=10.0) as client:
        for depth in range(max_depth):
            if current_entity_id == anchor_entity_id:
                break

            if current_entity_id in visited:
                raise TrustChainError(f"Cycle detected at {current_entity_id}")
            visited.add(current_entity_id)

            # Fetch entity configuration
            try:
                config_url = current_entity_id.rstrip("/") + WELL_KNOWN_PATH
                resp = await client.get(config_url)
                resp.raise_for_status()
                entity_config_jwt = resp.text
            except httpx.HTTPError as exc:
                raise TrustChainError(
                    f"Failed to fetch entity configuration from {current_entity_id}: {exc}"
                ) from exc

            # Verify self-signed entity configuration
            config_claims = verify_self_signed_jwt(entity_config_jwt)
            authority_hints = config_claims.get("authority_hints", [])

            if not authority_hints:
                raise TrustChainError(
                    f"Entity {current_entity_id} has no authority_hints "
                    f"and is not the trust anchor"
                )

            # Use first authority hint that leads toward the anchor
            next_authority = None
            for hint in authority_hints:
                if hint == anchor_entity_id:
                    next_authority = hint
                    break
            if not next_authority:
                next_authority = authority_hints[0]

            # Fetch subordinate statement from the authority
            try:
                fetch_url = (
                    f"{next_authority.rstrip('/')}/federation/fetch"
                    f"?sub={current_entity_id}"
                )
                resp = await client.get(fetch_url)
                resp.raise_for_status()
                sub_stmt_jwt = resp.text
            except httpx.HTTPError as exc:
                raise TrustChainError(
                    f"Failed to fetch subordinate statement from {next_authority}: {exc}"
                ) from exc

            # Fetch authority's entity configuration to get its JWKS
            try:
                auth_config_url = next_authority.rstrip("/") + WELL_KNOWN_PATH
                resp = await client.get(auth_config_url)
                resp.raise_for_status()
                auth_config_claims = verify_self_signed_jwt(resp.text)
                auth_jwks = auth_config_claims.get("jwks", {})
            except httpx.HTTPError as exc:
                raise TrustChainError(
                    f"Failed to fetch authority config from {next_authority}: {exc}"
                ) from exc

            # Verify subordinate statement
            stmt_claims = verify_subordinate_statement(sub_stmt_jwt, auth_jwks)
            chain_jwts.append(sub_stmt_jwt)

            # Accumulate policy
            stmt_policy = stmt_claims.get("metadata_policy", {})
            if stmt_policy:
                accumulated_policy = merge_policies(stmt_policy, accumulated_policy)

            current_entity_id = next_authority
        else:
            raise TrustChainError(
                f"Trust chain exceeded max depth ({max_depth})"
            )

    # The subject metadata comes from the first entity config
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            config_url = subject_entity_id.rstrip("/") + WELL_KNOWN_PATH
            resp = await client.get(config_url)
            resp.raise_for_status()
            subject_claims = verify_self_signed_jwt(resp.text)
            subject_metadata = subject_claims.get("metadata", {})
        except Exception:
            subject_metadata = {}

    resolved_metadata = subject_metadata
    if accumulated_policy:
        resolved_metadata = apply_policy(subject_metadata, accumulated_policy)

    return {
        "trust_chain": chain_jwts,
        "metadata": resolved_metadata,
        "subject": subject_entity_id,
        "anchor": anchor_entity_id,
    }
