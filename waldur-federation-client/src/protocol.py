"""Client for OpenID Federation 1.0 protocol endpoints."""

from __future__ import annotations

from typing import Any

import httpx

from .exceptions import (
    ConnectionError,
    FederationClientError,
    NotFoundError,
    ServerError,
)


class FederationProtocolClient:
    """Async client for the OpenID Federation 1.0 protocol endpoints.

    These are the standard federation endpoints defined by the spec,
    not the management API.

    Usage::

        async with FederationProtocolClient("https://anchor.example.org") as client:
            config_jwt = await client.get_entity_configuration()
    """

    def __init__(
        self,
        anchor_url: str,
        *,
        timeout: float = 30.0,
    ) -> None:
        self._anchor_url = anchor_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._anchor_url,
            timeout=timeout,
        )

    async def __aenter__(self) -> FederationProtocolClient:
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
        params: dict[str, Any] | None = None,
    ) -> httpx.Response:
        if params:
            params = {k: v for k, v in params.items() if v is not None}
        try:
            response = await self._client.request(method, path, params=params)
        except httpx.ConnectError as exc:
            raise ConnectionError(str(exc)) from exc
        except httpx.TimeoutException as exc:
            raise ConnectionError(f"Request timed out: {exc}") from exc

        if response.status_code == 404:
            raise NotFoundError(response.text)
        if response.status_code >= 500:
            raise ServerError(response.text, status_code=response.status_code)
        if response.status_code >= 400:
            raise FederationClientError(
                response.text, status_code=response.status_code
            )
        return response

    # ------------------------------------------------------------------
    # Federation Protocol Endpoints
    # ------------------------------------------------------------------

    async def get_entity_configuration(self) -> str:
        """Fetch the Trust Anchor's self-signed entity configuration JWT.

        ``GET /.well-known/openid-federation``
        """
        resp = await self._request("GET", "/.well-known/openid-federation")
        return resp.text

    async def fetch_subordinate_statement(
        self,
        sub: str,
        *,
        iss: str | None = None,
    ) -> str:
        """Fetch a subordinate statement for the given subject.

        ``GET /federation/fetch?sub=...``
        """
        resp = await self._request(
            "GET", "/federation/fetch", params={"sub": sub, "iss": iss}
        )
        return resp.text

    async def list_subordinates(
        self,
        *,
        entity_type: str | None = None,
    ) -> list[str]:
        """List subordinate entity IDs.

        ``GET /federation/list``
        """
        resp = await self._request(
            "GET", "/federation/list", params={"entity_type": entity_type}
        )
        return resp.json()

    async def resolve_trust_chain(
        self,
        sub: str,
        *,
        anchor: str | None = None,
    ) -> str:
        """Resolve a trust chain from subject to anchor.

        ``GET /federation/resolve?sub=...``

        Returns a signed resolve-response JWT.
        """
        resp = await self._request(
            "GET", "/federation/resolve", params={"sub": sub, "anchor": anchor}
        )
        return resp.text

    async def get_historical_keys(self) -> dict[str, Any]:
        """Fetch the historical JWK Set (includes rotated/revoked keys).

        ``GET /federation/historical_keys``
        """
        resp = await self._request("GET", "/federation/historical_keys")
        return resp.json()

    async def check_trust_mark_status(
        self,
        sub: str,
        trust_mark_id: str,
    ) -> dict[str, Any]:
        """Check whether a trust mark is active.

        ``GET /federation/trust_mark_status``
        """
        resp = await self._request(
            "GET",
            "/federation/trust_mark_status",
            params={"sub": sub, "id": trust_mark_id},
        )
        return resp.json()

    async def list_trust_marks(
        self,
        *,
        sub: str | None = None,
        trust_mark_id: str | None = None,
    ) -> list[str]:
        """List active trust mark JWTs.

        ``GET /federation/trust_mark_list``
        """
        resp = await self._request(
            "GET",
            "/federation/trust_mark_list",
            params={"sub": sub, "trust_mark_id": trust_mark_id},
        )
        return resp.json()
