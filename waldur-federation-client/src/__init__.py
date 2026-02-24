"""Waldur Federation Client — HTTP client for OpenID Federation 1.0 Trust Anchors.

Provides two clients:

- ``FederationClient`` — management API (entities, statements, policies, trust marks)
- ``FederationProtocolClient`` — OIDC Federation 1.0 protocol endpoints
"""

from .client import FederationClient
from .exceptions import (
    AuthenticationError,
    ConnectionError,
    FederationClientError,
    NotFoundError,
    ServerError,
    ValidationError,
)
from .interfaces import (
    EntityConfiguration,
    EntityConfigurationBuilder,
    FederationAuthMiddleware,
    HasValidTrustChain,
    IdentityBridge,
    TrustChainResolver,
    TrustChainResult,
    TrustMarkInfo,
)
from .models import (
    Entity,
    EntityCompliance,
    EntityList,
    ExpiringItem,
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
from .protocol import FederationProtocolClient

__all__ = [
    # Clients
    "FederationClient",
    "FederationProtocolClient",
    # Models
    "Entity",
    "EntityList",
    "Statement",
    "StatementList",
    "Policy",
    "PolicyList",
    "PolicyEvaluation",
    "EntityCompliance",
    "TrustMarkDefinition",
    "TrustMarkDefinitionList",
    "TrustMark",
    "TrustMarkList",
    "HealthStats",
    "ExpiringItem",
    "ExpiringItems",
    # Exceptions
    "FederationClientError",
    "ConnectionError",
    "AuthenticationError",
    "NotFoundError",
    "ValidationError",
    "ServerError",
    # Interface contracts
    "EntityConfiguration",
    "TrustChainResult",
    "TrustMarkInfo",
    "EntityConfigurationBuilder",
    "TrustChainResolver",
    "FederationAuthMiddleware",
    "HasValidTrustChain",
    "IdentityBridge",
]
