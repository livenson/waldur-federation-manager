"""HTTP client for the Waldur Federation Trust Anchor management API."""

from __future__ import annotations

from typing import Any

import httpx

from .exceptions import (
    AuthenticationError,
    ConnectionError,
    FederationClientError,
    NotFoundError,
    ServerError,
    ValidationError,
)
from .models import (
    Entity,
    EntityList,
    ExpiringItems,
    HealthStats,
    Policy,
    PolicyEvaluation,
    PolicyList,
    Statement,
    StatementList,
    TrustMark,
    TrustMarkDefinition,
    TrustMarkDefinitionList,
    TrustMarkList,
)


class FederationClient:
    """Async client for the Trust Anchor management API.

    Usage::

        async with FederationClient("http://localhost:9000") as client:
            entities = await client.list_entities()
    """

    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 30.0,
        headers: dict[str, str] | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
            headers=headers or {},
        )

    async def __aenter__(self) -> FederationClient:
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> httpx.Response:
        # Strip None values from params
        if params:
            params = {k: v for k, v in params.items() if v is not None}
        try:
            response = await self._client.request(
                method, path, json=json, params=params
            )
        except httpx.ConnectError as exc:
            raise ConnectionError(str(exc)) from exc
        except httpx.TimeoutException as exc:
            raise ConnectionError(f"Request timed out: {exc}") from exc

        if response.status_code in (401, 403):
            raise AuthenticationError(response.text, status_code=response.status_code)
        if response.status_code == 404:
            raise NotFoundError(response.text)
        if response.status_code == 422:
            details = None
            try:
                body = response.json()
                details = body.get("detail")
            except Exception:
                pass
            raise ValidationError(response.text, details=details)
        if response.status_code >= 500:
            raise ServerError(response.text, status_code=response.status_code)
        if response.status_code >= 400:
            raise FederationClientError(
                response.text, status_code=response.status_code
            )
        return response

    # ------------------------------------------------------------------
    # Entities
    # ------------------------------------------------------------------

    async def create_entity(
        self,
        entity_id: str,
        name: str,
        *,
        organization: str | None = None,
        country: str | None = None,
        entity_types: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        authority_hints: list[str] | None = None,
        contacts: list[str] | None = None,
        statement_expires_seconds: int | None = None,
        jwks: dict[str, Any] | None = None,
    ) -> Entity:
        payload: dict[str, Any] = {"entity_id": entity_id, "name": name}
        if organization is not None:
            payload["organization"] = organization
        if country is not None:
            payload["country"] = country
        if entity_types is not None:
            payload["entity_types"] = entity_types
        if metadata is not None:
            payload["metadata"] = metadata
        if authority_hints is not None:
            payload["authority_hints"] = authority_hints
        if contacts is not None:
            payload["contacts"] = contacts
        if statement_expires_seconds is not None:
            payload["statement_expires_seconds"] = statement_expires_seconds
        if jwks is not None:
            payload["jwks"] = jwks
        resp = await self._request("POST", "/api/entities", json=payload)
        return Entity.from_dict(resp.json())

    async def list_entities(
        self,
        *,
        status: str | None = None,
        entity_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> EntityList:
        resp = await self._request(
            "GET",
            "/api/entities",
            params={
                "status": status,
                "entity_type": entity_type,
                "skip": skip,
                "limit": limit,
            },
        )
        return EntityList.from_dict(resp.json())

    async def get_entity(self, entity_id: str) -> Entity:
        resp = await self._request("GET", f"/api/entities/{entity_id}")
        return Entity.from_dict(resp.json())

    async def update_entity(
        self,
        entity_id: str,
        *,
        name: str | None = None,
        organization: str | None = None,
        country: str | None = None,
        entity_types: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        authority_hints: list[str] | None = None,
        contacts: list[str] | None = None,
        statement_expires_seconds: int | None = None,
    ) -> Entity:
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if organization is not None:
            payload["organization"] = organization
        if country is not None:
            payload["country"] = country
        if entity_types is not None:
            payload["entity_types"] = entity_types
        if metadata is not None:
            payload["metadata"] = metadata
        if authority_hints is not None:
            payload["authority_hints"] = authority_hints
        if contacts is not None:
            payload["contacts"] = contacts
        if statement_expires_seconds is not None:
            payload["statement_expires_seconds"] = statement_expires_seconds
        resp = await self._request(
            "PATCH", f"/api/entities/{entity_id}", json=payload
        )
        return Entity.from_dict(resp.json())

    async def delete_entity(self, entity_id: str) -> None:
        await self._request("DELETE", f"/api/entities/{entity_id}")

    async def activate_entity(self, entity_id: str) -> Entity:
        resp = await self._request("POST", f"/api/entities/{entity_id}/activate")
        return Entity.from_dict(resp.json())

    async def suspend_entity(self, entity_id: str) -> Entity:
        resp = await self._request("POST", f"/api/entities/{entity_id}/suspend")
        return Entity.from_dict(resp.json())

    async def revoke_entity(self, entity_id: str) -> Entity:
        resp = await self._request("POST", f"/api/entities/{entity_id}/revoke")
        return Entity.from_dict(resp.json())

    async def rotate_entity_keys(self, entity_id: str) -> Entity:
        resp = await self._request("POST", f"/api/entities/{entity_id}/rotate-keys")
        return Entity.from_dict(resp.json())

    # ------------------------------------------------------------------
    # Statements
    # ------------------------------------------------------------------

    async def create_statement(
        self,
        subject_entity_id: str,
        *,
        metadata_override: dict[str, Any] | None = None,
        metadata_policy: dict[str, Any] | None = None,
        constraints: dict[str, Any] | None = None,
        trust_marks: list[dict[str, Any]] | None = None,
        expires_in_seconds: int | None = None,
    ) -> Statement:
        payload: dict[str, Any] = {"subject_entity_id": subject_entity_id}
        if metadata_override is not None:
            payload["metadata_override"] = metadata_override
        if metadata_policy is not None:
            payload["metadata_policy"] = metadata_policy
        if constraints is not None:
            payload["constraints"] = constraints
        if trust_marks is not None:
            payload["trust_marks"] = trust_marks
        if expires_in_seconds is not None:
            payload["expires_in_seconds"] = expires_in_seconds
        resp = await self._request("POST", "/api/statements", json=payload)
        return Statement.from_dict(resp.json())

    async def list_statements(
        self,
        *,
        subject_entity_id: str | None = None,
        current_only: bool = True,
        skip: int = 0,
        limit: int = 50,
    ) -> StatementList:
        resp = await self._request(
            "GET",
            "/api/statements",
            params={
                "subject_entity_id": subject_entity_id,
                "current_only": current_only,
                "skip": skip,
                "limit": limit,
            },
        )
        return StatementList.from_dict(resp.json())

    async def get_statement(self, statement_id: str) -> Statement:
        resp = await self._request("GET", f"/api/statements/{statement_id}")
        return Statement.from_dict(resp.json())

    async def regenerate_statement(self, statement_id: str) -> Statement:
        resp = await self._request(
            "POST", f"/api/statements/{statement_id}/regenerate"
        )
        return Statement.from_dict(resp.json())

    async def bulk_regenerate_statements(self) -> dict[str, int]:
        resp = await self._request("POST", "/api/statements/bulk-regenerate")
        return resp.json()

    # ------------------------------------------------------------------
    # Policies
    # ------------------------------------------------------------------

    async def create_policy(
        self,
        name: str,
        entity_type: str,
        *,
        description: str | None = None,
        policy: dict[str, Any] | None = None,
    ) -> Policy:
        payload: dict[str, Any] = {"name": name, "entity_type": entity_type}
        if description is not None:
            payload["description"] = description
        if policy is not None:
            payload["policy"] = policy
        resp = await self._request("POST", "/api/policies", json=payload)
        return Policy.from_dict(resp.json())

    async def list_policies(
        self,
        *,
        entity_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> PolicyList:
        resp = await self._request(
            "GET",
            "/api/policies",
            params={"entity_type": entity_type, "skip": skip, "limit": limit},
        )
        return PolicyList.from_dict(resp.json())

    async def get_policy(self, policy_id: str) -> Policy:
        resp = await self._request("GET", f"/api/policies/{policy_id}")
        return Policy.from_dict(resp.json())

    async def update_policy(
        self,
        policy_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        entity_type: str | None = None,
        policy: dict[str, Any] | None = None,
    ) -> Policy:
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if description is not None:
            payload["description"] = description
        if entity_type is not None:
            payload["entity_type"] = entity_type
        if policy is not None:
            payload["policy"] = policy
        resp = await self._request(
            "PATCH", f"/api/policies/{policy_id}", json=payload
        )
        return Policy.from_dict(resp.json())

    async def delete_policy(self, policy_id: str) -> None:
        await self._request("DELETE", f"/api/policies/{policy_id}")

    async def evaluate_policy(self, policy_id: str) -> PolicyEvaluation:
        resp = await self._request("POST", f"/api/policies/{policy_id}/evaluate")
        return PolicyEvaluation.from_dict(resp.json())

    # ------------------------------------------------------------------
    # Trust Marks
    # ------------------------------------------------------------------

    async def create_trust_mark_definition(
        self,
        trust_mark_id: str,
        name: str,
        *,
        description: str | None = None,
        ref: str | None = None,
        logo_uri: str | None = None,
        allowed_issuer_ids: list[str] | None = None,
    ) -> TrustMarkDefinition:
        payload: dict[str, Any] = {"trust_mark_id": trust_mark_id, "name": name}
        if description is not None:
            payload["description"] = description
        if ref is not None:
            payload["ref"] = ref
        if logo_uri is not None:
            payload["logo_uri"] = logo_uri
        if allowed_issuer_ids is not None:
            payload["allowed_issuer_ids"] = allowed_issuer_ids
        resp = await self._request(
            "POST", "/api/trust-marks/definitions", json=payload
        )
        return TrustMarkDefinition.from_dict(resp.json())

    async def list_trust_mark_definitions(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
    ) -> TrustMarkDefinitionList:
        resp = await self._request(
            "GET",
            "/api/trust-marks/definitions",
            params={"skip": skip, "limit": limit},
        )
        return TrustMarkDefinitionList.from_dict(resp.json())

    async def get_trust_mark_definition(
        self, definition_id: str
    ) -> TrustMarkDefinition:
        resp = await self._request(
            "GET", f"/api/trust-marks/definitions/{definition_id}"
        )
        return TrustMarkDefinition.from_dict(resp.json())

    async def update_trust_mark_definition(
        self,
        definition_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        ref: str | None = None,
        logo_uri: str | None = None,
        allowed_issuer_ids: list[str] | None = None,
    ) -> TrustMarkDefinition:
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if description is not None:
            payload["description"] = description
        if ref is not None:
            payload["ref"] = ref
        if logo_uri is not None:
            payload["logo_uri"] = logo_uri
        if allowed_issuer_ids is not None:
            payload["allowed_issuer_ids"] = allowed_issuer_ids
        resp = await self._request(
            "PATCH", f"/api/trust-marks/definitions/{definition_id}", json=payload
        )
        return TrustMarkDefinition.from_dict(resp.json())

    async def delete_trust_mark_definition(self, definition_id: str) -> None:
        await self._request(
            "DELETE", f"/api/trust-marks/definitions/{definition_id}"
        )

    async def issue_trust_mark(
        self,
        trust_mark_id: str,
        subject_entity_id: str,
        *,
        expires_in_seconds: int | None = None,
    ) -> TrustMark:
        payload: dict[str, Any] = {
            "trust_mark_id": trust_mark_id,
            "subject_entity_id": subject_entity_id,
        }
        if expires_in_seconds is not None:
            payload["expires_in_seconds"] = expires_in_seconds
        resp = await self._request("POST", "/api/trust-marks/issue", json=payload)
        return TrustMark.from_dict(resp.json())

    async def list_trust_marks(
        self,
        *,
        subject_entity_id: str | None = None,
        trust_mark_id: str | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> TrustMarkList:
        resp = await self._request(
            "GET",
            "/api/trust-marks",
            params={
                "subject_entity_id": subject_entity_id,
                "trust_mark_id": trust_mark_id,
                "status": status,
                "skip": skip,
                "limit": limit,
            },
        )
        return TrustMarkList.from_dict(resp.json())

    async def revoke_trust_mark(
        self,
        mark_id: str,
        *,
        reason: str | None = None,
    ) -> TrustMark:
        payload: dict[str, Any] | None = None
        if reason is not None:
            payload = {"reason": reason}
        resp = await self._request(
            "POST", f"/api/trust-marks/{mark_id}/revoke", json=payload
        )
        return TrustMark.from_dict(resp.json())

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    async def get_health_stats(self) -> HealthStats:
        resp = await self._request("GET", "/api/health/stats")
        return HealthStats.from_dict(resp.json())

    async def get_expiring_items(self, *, days: int = 3) -> ExpiringItems:
        resp = await self._request(
            "GET", "/api/health/expiring", params={"days": days}
        )
        return ExpiringItems.from_dict(resp.json())
