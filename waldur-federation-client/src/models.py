"""Response models matching the backend Pydantic schemas."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


def _parse_dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    # Handle ISO format with or without timezone
    return datetime.fromisoformat(value)


# ---------------------------------------------------------------------------
# Entity
# ---------------------------------------------------------------------------


@dataclass
class Entity:
    id: str
    entity_id: str
    name: str
    status: str
    entity_types: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    jwks: dict[str, Any] = field(default_factory=dict)
    authority_hints: list[str] = field(default_factory=list)
    contacts: list[str] = field(default_factory=list)
    organization: str | None = None
    country: str | None = None
    statement_expires_seconds: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Entity:
        return cls(
            id=str(data["id"]),
            entity_id=data["entity_id"],
            name=data["name"],
            status=data["status"],
            entity_types=data.get("entity_types", []),
            metadata=data.get("metadata", {}),
            jwks=data.get("jwks", {}),
            authority_hints=data.get("authority_hints", []),
            contacts=data.get("contacts", []),
            organization=data.get("organization"),
            country=data.get("country"),
            statement_expires_seconds=data.get("statement_expires_seconds"),
            created_at=_parse_dt(data.get("created_at")),
            updated_at=_parse_dt(data.get("updated_at")),
        )


@dataclass
class EntityList:
    entities: list[Entity]
    total: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EntityList:
        return cls(
            entities=[Entity.from_dict(e) for e in data["entities"]],
            total=data["total"],
        )


# ---------------------------------------------------------------------------
# Statement
# ---------------------------------------------------------------------------


@dataclass
class Statement:
    id: str
    issuer_entity_id: str
    subject_entity_id: str
    jwt: str
    is_current: bool
    metadata_override: dict[str, Any] = field(default_factory=dict)
    metadata_policy: dict[str, Any] = field(default_factory=dict)
    constraints: dict[str, Any] = field(default_factory=dict)
    trust_marks: list[Any] = field(default_factory=list)
    issued_at: datetime | None = None
    expires_at: datetime | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Statement:
        return cls(
            id=str(data["id"]),
            issuer_entity_id=data["issuer_entity_id"],
            subject_entity_id=data["subject_entity_id"],
            jwt=data["jwt"],
            is_current=data["is_current"],
            metadata_override=data.get("metadata_override", {}),
            metadata_policy=data.get("metadata_policy", {}),
            constraints=data.get("constraints", {}),
            trust_marks=data.get("trust_marks", []),
            issued_at=_parse_dt(data.get("issued_at")),
            expires_at=_parse_dt(data.get("expires_at")),
        )


@dataclass
class StatementList:
    statements: list[Statement]
    total: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> StatementList:
        return cls(
            statements=[Statement.from_dict(s) for s in data["statements"]],
            total=data["total"],
        )


# ---------------------------------------------------------------------------
# Policy
# ---------------------------------------------------------------------------


@dataclass
class Policy:
    id: str
    name: str
    entity_type: str
    policy: dict[str, Any] = field(default_factory=dict)
    description: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Policy:
        return cls(
            id=str(data["id"]),
            name=data["name"],
            entity_type=data["entity_type"],
            policy=data.get("policy", {}),
            description=data.get("description"),
            created_at=_parse_dt(data.get("created_at")),
            updated_at=_parse_dt(data.get("updated_at")),
        )


@dataclass
class PolicyList:
    policies: list[Policy]
    total: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PolicyList:
        return cls(
            policies=[Policy.from_dict(p) for p in data["policies"]],
            total=data["total"],
        )


@dataclass
class EntityCompliance:
    entity_id: str
    entity_name: str
    entity_url: str
    status: str
    violations: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EntityCompliance:
        return cls(
            entity_id=str(data["entity_id"]),
            entity_name=data["entity_name"],
            entity_url=data["entity_url"],
            status=data["status"],
            violations=data.get("violations", []),
        )


@dataclass
class PolicyEvaluation:
    policy_id: str
    policy_name: str
    entity_type: str
    total_entities: int
    compliant: int
    non_compliant: int
    results: list[EntityCompliance] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PolicyEvaluation:
        return cls(
            policy_id=str(data["policy_id"]),
            policy_name=data["policy_name"],
            entity_type=data["entity_type"],
            total_entities=data["total_entities"],
            compliant=data["compliant"],
            non_compliant=data["non_compliant"],
            results=[EntityCompliance.from_dict(r) for r in data.get("results", [])],
        )


# ---------------------------------------------------------------------------
# Trust Mark
# ---------------------------------------------------------------------------


@dataclass
class TrustMarkDefinition:
    id: str
    trust_mark_id: str
    name: str
    description: str | None = None
    ref: str | None = None
    logo_uri: str | None = None
    allowed_issuer_ids: list[str] = field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TrustMarkDefinition:
        return cls(
            id=str(data["id"]),
            trust_mark_id=data["trust_mark_id"],
            name=data["name"],
            description=data.get("description"),
            ref=data.get("ref"),
            logo_uri=data.get("logo_uri"),
            allowed_issuer_ids=data.get("allowed_issuer_ids", []),
            created_at=_parse_dt(data.get("created_at")),
            updated_at=_parse_dt(data.get("updated_at")),
        )


@dataclass
class TrustMarkDefinitionList:
    definitions: list[TrustMarkDefinition]
    total: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TrustMarkDefinitionList:
        return cls(
            definitions=[TrustMarkDefinition.from_dict(d) for d in data["definitions"]],
            total=data["total"],
        )


@dataclass
class TrustMark:
    id: str
    trust_mark_id: str
    subject_entity_id: str
    jwt: str
    status: str
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    revocation_reason: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TrustMark:
        return cls(
            id=str(data["id"]),
            trust_mark_id=data["trust_mark_id"],
            subject_entity_id=data["subject_entity_id"],
            jwt=data["jwt"],
            status=data["status"],
            issued_at=_parse_dt(data.get("issued_at")),
            expires_at=_parse_dt(data.get("expires_at")),
            revoked_at=_parse_dt(data.get("revoked_at")),
            revocation_reason=data.get("revocation_reason"),
        )


@dataclass
class TrustMarkList:
    trust_marks: list[TrustMark]
    total: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TrustMarkList:
        return cls(
            trust_marks=[TrustMark.from_dict(tm) for tm in data["trust_marks"]],
            total=data["total"],
        )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@dataclass
class HealthStats:
    entities: dict[str, Any]
    statements: dict[str, Any]
    keys: dict[str, Any]
    trust_marks: dict[str, Any]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> HealthStats:
        return cls(
            entities=data["entities"],
            statements=data["statements"],
            keys=data["keys"],
            trust_marks=data["trust_marks"],
        )


@dataclass
class ExpiringItem:
    id: str
    subject: str
    expires_at: str | None = None
    trust_mark_id: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ExpiringItem:
        return cls(
            id=str(data["id"]),
            subject=data["subject"],
            expires_at=data.get("expires_at"),
            trust_mark_id=data.get("trust_mark_id"),
        )


@dataclass
class ExpiringItems:
    statements: list[ExpiringItem]
    trust_marks: list[ExpiringItem]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ExpiringItems:
        return cls(
            statements=[ExpiringItem.from_dict(s) for s in data.get("statements", [])],
            trust_marks=[ExpiringItem.from_dict(tm) for tm in data.get("trust_marks", [])],
        )
