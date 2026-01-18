"""Waldur API client for instance discovery and health checks."""

from datetime import datetime
from typing import Any

import httpx

from app.config import get_settings

settings = get_settings()


class WaldurClientError(Exception):
    """Base exception for Waldur client errors."""

    pass


class WaldurAuthError(WaldurClientError):
    """Authentication error."""

    pass


class WaldurNotFoundError(WaldurClientError):
    """Resource not found error."""

    pass


class WaldurClient:
    """Client for interacting with Waldur API."""

    def __init__(
        self,
        base_url: str,
        api_token: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        """Initialize Waldur client.

        Args:
            base_url: Waldur instance base URL (e.g., https://waldur.example.com)
            api_token: API authentication token
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "WaldurClient":
        """Enter async context."""
        await self._ensure_client()
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Exit async context."""
        await self.close()

    async def _ensure_client(self) -> None:
        """Ensure HTTP client is initialized."""
        if self._client is None:
            headers = {"Content-Type": "application/json"}
            if self.api_token:
                headers["Authorization"] = f"Token {self.api_token}"

            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=headers,
                timeout=self.timeout,
            )

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        path: str,
        params: dict | None = None,
        json_data: dict | None = None,
    ) -> dict | list:
        """Make an HTTP request to the Waldur API."""
        await self._ensure_client()
        assert self._client is not None

        try:
            response = await self._client.request(
                method=method,
                url=path,
                params=params,
                json=json_data,
            )

            if response.status_code == 401:
                raise WaldurAuthError("Authentication failed")
            elif response.status_code == 404:
                raise WaldurNotFoundError(f"Resource not found: {path}")
            elif response.status_code >= 400:
                raise WaldurClientError(
                    f"Request failed with status {response.status_code}: {response.text}"
                )

            return response.json()

        except httpx.TimeoutException as e:
            raise WaldurClientError(f"Request timed out: {e}")
        except httpx.RequestError as e:
            raise WaldurClientError(f"Request failed: {e}")

    async def check_health(self) -> dict:
        """Check instance health and get basic info.

        Returns:
            Dict with health status, version, and response time
        """
        start_time = datetime.utcnow()

        try:
            version_info = await self._request("GET", "/api/version/")
            end_time = datetime.utcnow()
            response_time_ms = int((end_time - start_time).total_seconds() * 1000)

            return {
                "healthy": True,
                "version": version_info.get("version") if isinstance(version_info, dict) else None,
                "response_time_ms": response_time_ms,
                "checked_at": end_time.isoformat(),
                "error": None,
            }
        except WaldurClientError as e:
            end_time = datetime.utcnow()
            return {
                "healthy": False,
                "version": None,
                "response_time_ms": int((end_time - start_time).total_seconds() * 1000),
                "checked_at": end_time.isoformat(),
                "error": str(e),
            }

    async def get_configuration(self) -> dict:
        """Get Waldur instance configuration.

        Returns:
            Configuration dict with instance UUID and settings
        """
        result = await self._request("GET", "/api/configuration/")
        if isinstance(result, dict):
            return result
        return {}

    async def get_instance_stats(self) -> dict:
        """Get basic statistics about the Waldur instance.

        Returns:
            Dict with counts of customers, projects, offerings, etc.
        """
        stats = {
            "customers": 0,
            "projects": 0,
            "offerings": 0,
        }

        try:
            # Get customer count
            customers = await self._request("GET", "/api/customers/", params={"page_size": 1})
            if isinstance(customers, dict):
                stats["customers"] = customers.get("count", 0)
            elif isinstance(customers, list):
                stats["customers"] = len(customers)

            # Get project count
            projects = await self._request("GET", "/api/projects/", params={"page_size": 1})
            if isinstance(projects, dict):
                stats["projects"] = projects.get("count", 0)
            elif isinstance(projects, list):
                stats["projects"] = len(projects)

            # Get offering count
            offerings = await self._request(
                "GET", "/api/marketplace-offerings/", params={"page_size": 1, "state": "Active"}
            )
            if isinstance(offerings, dict):
                stats["offerings"] = offerings.get("count", 0)
            elif isinstance(offerings, list):
                stats["offerings"] = len(offerings)

        except WaldurClientError:
            pass  # Stats are optional, don't fail if not accessible

        return stats

    async def verify_api_token(self) -> dict:
        """Verify that the API token is valid.

        Returns:
            Dict with user info if token is valid
        """
        if not self.api_token:
            raise WaldurAuthError("No API token provided")

        result = await self._request("GET", "/api/users/me/")
        if isinstance(result, dict):
            return {
                "valid": True,
                "user_uuid": result.get("uuid"),
                "username": result.get("username"),
                "email": result.get("email"),
                "is_staff": result.get("is_staff", False),
            }
        raise WaldurAuthError("Invalid token response")

    async def get_remote_customers(self) -> list[dict]:
        """Get list of customers for federation (remote customer feature).

        Returns:
            List of customer dicts suitable for federation
        """
        result = await self._request("GET", "/api/customers/", params={"page_size": 1000})

        customers = result.get("results", []) if isinstance(result, dict) else result

        return [
            {
                "uuid": c.get("uuid"),
                "name": c.get("name"),
                "abbreviation": c.get("abbreviation"),
                "country": c.get("country"),
            }
            for c in customers
            if isinstance(c, dict)
        ]

    async def create_remote_customer(self, customer_data: dict) -> dict:
        """Create a remote customer in the Waldur instance.

        Args:
            customer_data: Customer data to create

        Returns:
            Created customer data
        """
        result = await self._request("POST", "/api/remote-waldur-customers/", json_data=customer_data)
        if isinstance(result, dict):
            return result
        raise WaldurClientError("Unexpected response format")

    async def get_shared_offerings(self) -> list[dict]:
        """Get offerings that can be shared in federation.

        Returns:
            List of active offerings
        """
        result = await self._request(
            "GET",
            "/api/marketplace-offerings/",
            params={"state": "Active", "page_size": 1000},
        )

        offerings = result.get("results", []) if isinstance(result, dict) else result

        return [
            {
                "uuid": o.get("uuid"),
                "name": o.get("name"),
                "category": o.get("category_title"),
                "state": o.get("state"),
                "customer_uuid": o.get("customer_uuid"),
            }
            for o in offerings
            if isinstance(o, dict)
        ]
