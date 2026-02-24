"""Interface definitions for Waldur Federation client components.

These interfaces define the contracts that the Waldur core implementation
must fulfill to participate in an OpenID Federation 1.0 trust hierarchy.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class EntityConfiguration:
    """Represents an OpenID Federation entity configuration."""
    entity_id: str
    jwks: dict[str, Any]
    metadata: dict[str, Any]
    authority_hints: list[str]
    contacts: list[str]


@dataclass
class TrustChainResult:
    """Result of a trust chain resolution."""
    trust_chain: list[str]  # List of JWT strings
    metadata: dict[str, Any]  # Resolved metadata after policy application
    subject: str
    anchor: str
    is_valid: bool
    error: str | None = None


@dataclass
class TrustMarkInfo:
    """Information about a trust mark."""
    trust_mark_id: str
    subject: str
    issuer: str
    is_active: bool
    jwt: str


class EntityConfigurationBuilder(ABC):
    """Builds entity configuration JWTs for a Waldur instance.

    The Waldur instance acts as a federation entity and needs to publish
    its entity configuration at /.well-known/openid-federation.
    """

    @abstractmethod
    async def build(self) -> str:
        """Build and return a self-signed entity configuration JWT."""
        ...

    @abstractmethod
    async def get_jwks(self) -> dict[str, Any]:
        """Return the current JWK Set for this entity."""
        ...


class TrustChainResolver(ABC):
    """Resolves trust chains from a subject entity to a trust anchor.

    Implements caching to avoid repeated network calls for the same chains.
    """

    @abstractmethod
    async def resolve(
        self,
        subject_entity_id: str,
        trust_anchor_entity_id: str,
    ) -> TrustChainResult:
        """Resolve the trust chain from subject to anchor."""
        ...

    @abstractmethod
    async def is_trusted(
        self,
        entity_id: str,
        trust_anchor_entity_id: str | None = None,
    ) -> bool:
        """Check if an entity is trusted (has valid chain to anchor)."""
        ...

    @abstractmethod
    def invalidate_cache(self, entity_id: str | None = None) -> None:
        """Invalidate cached trust chain results.

        If entity_id is None, invalidate all cached results.
        """
        ...


class FederationAuthMiddleware(ABC):
    """Middleware for authenticating federation requests.

    Validates incoming requests against the federation trust hierarchy.
    Extracts entity identity from federation JWTs.
    """

    @abstractmethod
    async def authenticate(self, token: str) -> dict[str, Any]:
        """Authenticate a federation JWT and return the claims.

        Verifies the JWT signature against the issuer's published JWKS,
        then validates the trust chain from issuer to trust anchor.
        """
        ...


class HasValidTrustChain(ABC):
    """Permission class for Django REST Framework / FastAPI.

    Checks that the requesting entity has a valid trust chain
    to the configured trust anchor before allowing access.
    """

    @abstractmethod
    async def has_permission(self, entity_id: str) -> bool:
        """Check if the entity has a valid trust chain."""
        ...


class IdentityBridge(ABC):
    """Bridge between federation entity identity and Waldur's identity system.

    Maps federation entity_ids to Waldur users/organizations and vice versa.
    """

    @abstractmethod
    async def get_waldur_identity(self, entity_id: str) -> dict[str, Any] | None:
        """Map a federation entity_id to a Waldur identity (user/org).

        Returns None if no mapping exists.
        """
        ...

    @abstractmethod
    async def get_entity_id(self, waldur_user_id: str) -> str | None:
        """Map a Waldur user/org ID to a federation entity_id.

        Returns None if no mapping exists.
        """
        ...
