# Waldur Federation Client

Python client library for interacting with a Waldur Federation Trust Anchor. Provides async HTTP clients for both the management API and the OpenID Federation 1.0 protocol endpoints.

## Installation

```bash
pip install waldur-federation-client
```

Or with [uv](https://docs.astral.sh/uv/):

```bash
uv add waldur-federation-client
```

**Requirements**: Python 3.11+

## Quick Start

```python
import asyncio
from src import FederationClient

async def main():
    async with FederationClient("http://localhost:9000") as client:
        # Register an entity
        entity = await client.create_entity(
            entity_id="https://rp.example.org",
            name="Example Relying Party",
            entity_types=["openid_relying_party"],
        )
        print(f"Created: {entity.name} ({entity.status})")

        # Activate it
        entity = await client.activate_entity(entity.id)
        print(f"Status: {entity.status}")

        # List all active entities
        result = await client.list_entities(status="active")
        for e in result.entities:
            print(f"  - {e.name}: {e.entity_id}")

asyncio.run(main())
```

## Management API Reference

### `FederationClient`

```python
FederationClient(base_url, *, timeout=30.0, headers=None)
```

Async context manager for the Trust Anchor management API (`/api/...`).

| Parameter  | Type             | Description                      |
|------------|------------------|----------------------------------|
| `base_url` | `str`            | Trust Anchor URL (e.g. `http://localhost:9000`) |
| `timeout`  | `float`          | Request timeout in seconds       |
| `headers`  | `dict` or `None` | Extra HTTP headers               |

---

### Entities

#### `create_entity(entity_id, name, **kwargs) -> Entity`

Register a new entity in draft status.

```python
entity = await client.create_entity(
    entity_id="https://rp.example.org",
    name="Example RP",
    organization="Example Corp",
    country="EE",
    entity_types=["openid_relying_party"],
    contacts=["admin@example.org"],
)
```

Optional keyword arguments: `organization`, `country`, `entity_types`, `metadata`, `authority_hints`, `contacts`, `statement_expires_seconds`, `jwks`.

#### `list_entities(**kwargs) -> EntityList`

```python
result = await client.list_entities(status="active", limit=20)
for entity in result.entities:
    print(entity.name)
print(f"Total: {result.total}")
```

Optional filters: `status`, `entity_type`, `skip`, `limit`.

#### `get_entity(entity_id) -> Entity`

Fetch a single entity by its UUID.

#### `update_entity(entity_id, **kwargs) -> Entity`

Update entity fields. Only provided fields are changed.

```python
entity = await client.update_entity(entity_id, name="New Name")
```

#### `delete_entity(entity_id) -> None`

Delete a draft entity.

#### `activate_entity(entity_id) -> Entity`

Transition from `draft` to `active`. Generates signing keys and a subordinate statement.

#### `suspend_entity(entity_id) -> Entity`

Suspend an active entity. Invalidates current statements.

#### `revoke_entity(entity_id) -> Entity`

Permanently revoke an entity.

#### `rotate_entity_keys(entity_id) -> Entity`

Generate new signing keys. The old key is marked as rotated.

---

### Statements

#### `create_statement(subject_entity_id, **kwargs) -> Statement`

Issue a new subordinate statement.

```python
stmt = await client.create_statement(
    subject_entity_id="https://rp.example.org",
    metadata_policy={"openid_relying_party": {"grant_types": {"subset_of": ["authorization_code"]}}},
)
print(stmt.jwt)
```

Optional: `metadata_override`, `metadata_policy`, `constraints`, `trust_marks`, `expires_in_seconds`.

#### `list_statements(**kwargs) -> StatementList`

Optional filters: `subject_entity_id`, `current_only` (default `True`), `skip`, `limit`.

#### `get_statement(statement_id) -> Statement`

#### `regenerate_statement(statement_id) -> Statement`

Re-sign the statement with fresh timestamps.

#### `bulk_regenerate_statements() -> dict`

Regenerate all current statements. Returns `{"regenerated": N, "errors": N}`.

---

### Policies

#### `create_policy(name, entity_type, **kwargs) -> Policy`

```python
policy = await client.create_policy(
    name="RP Grant Types",
    entity_type="openid_relying_party",
    policy={"grant_types": {"subset_of": ["authorization_code"]}},
)
```

Optional: `description`, `policy`.

#### `list_policies(**kwargs) -> PolicyList`

Optional filters: `entity_type`, `skip`, `limit`.

#### `get_policy(policy_id) -> Policy`

#### `update_policy(policy_id, **kwargs) -> Policy`

#### `delete_policy(policy_id) -> None`

#### `evaluate_policy(policy_id) -> PolicyEvaluation`

Evaluate a policy against all matching entities.

```python
result = await client.evaluate_policy(policy_id)
print(f"{result.compliant}/{result.total_entities} compliant")
for r in result.results:
    if r.status == "non_compliant":
        print(f"  {r.entity_name}: {r.violations}")
```

---

### Trust Marks

#### `create_trust_mark_definition(trust_mark_id, name, **kwargs) -> TrustMarkDefinition`

```python
defn = await client.create_trust_mark_definition(
    trust_mark_id="https://anchor.example.org/trust-marks/verified",
    name="Verified Entity",
    description="Entity has passed verification",
)
```

Optional: `description`, `ref`, `logo_uri`, `allowed_issuer_ids`.

#### `list_trust_mark_definitions(**kwargs) -> TrustMarkDefinitionList`

#### `get_trust_mark_definition(definition_id) -> TrustMarkDefinition`

#### `update_trust_mark_definition(definition_id, **kwargs) -> TrustMarkDefinition`

#### `delete_trust_mark_definition(definition_id) -> None`

#### `issue_trust_mark(trust_mark_id, subject_entity_id, **kwargs) -> TrustMark`

```python
mark = await client.issue_trust_mark(
    trust_mark_id="https://anchor.example.org/trust-marks/verified",
    subject_entity_id="https://rp.example.org",
)
```

Optional: `expires_in_seconds`.

#### `list_trust_marks(**kwargs) -> TrustMarkList`

Optional filters: `subject_entity_id`, `trust_mark_id`, `status`, `skip`, `limit`.

#### `revoke_trust_mark(mark_id, *, reason=None) -> TrustMark`

---

### Health

#### `get_health_stats() -> HealthStats`

```python
stats = await client.get_health_stats()
print(f"Active entities: {stats.entities['by_status']['active']}")
print(f"Expiring statements: {stats.statements['expiring_soon']}")
```

#### `get_expiring_items(*, days=3) -> ExpiringItems`

```python
expiring = await client.get_expiring_items(days=7)
for stmt in expiring.statements:
    print(f"Statement {stmt.id} for {stmt.subject} expires {stmt.expires_at}")
```

---

## Federation Protocol Reference

### `FederationProtocolClient`

```python
FederationProtocolClient(anchor_url, *, timeout=30.0)
```

Client for the standard OpenID Federation 1.0 protocol endpoints.

```python
from src import FederationProtocolClient

async with FederationProtocolClient("https://anchor.example.org") as proto:
    # Get trust anchor configuration
    config_jwt = await proto.get_entity_configuration()

    # List subordinates
    entities = await proto.list_subordinates()

    # Fetch a subordinate statement
    stmt_jwt = await proto.fetch_subordinate_statement(sub="https://rp.example.org")

    # Resolve trust chain
    chain_jwt = await proto.resolve_trust_chain(sub="https://rp.example.org")

    # Check trust mark status
    status = await proto.check_trust_mark_status(
        sub="https://rp.example.org",
        trust_mark_id="https://anchor.example.org/trust-marks/verified",
    )
    print(f"Active: {status['active']}")
```

| Method | Endpoint | Returns |
|--------|----------|---------|
| `get_entity_configuration()` | `GET /.well-known/openid-federation` | `str` (JWT) |
| `fetch_subordinate_statement(sub, iss=None)` | `GET /federation/fetch` | `str` (JWT) |
| `list_subordinates(entity_type=None)` | `GET /federation/list` | `list[str]` |
| `resolve_trust_chain(sub, anchor=None)` | `GET /federation/resolve` | `str` (JWT) |
| `get_historical_keys()` | `GET /federation/historical_keys` | `dict` (JWKS) |
| `check_trust_mark_status(sub, trust_mark_id)` | `GET /federation/trust_mark_status` | `dict` |
| `list_trust_marks(sub=None, trust_mark_id=None)` | `GET /federation/trust_mark_list` | `list[str]` |

---

## Error Handling

All client methods raise exceptions from the `src.exceptions` module:

```python
from src import FederationClient, NotFoundError, ValidationError

async with FederationClient("http://localhost:9000") as client:
    try:
        entity = await client.get_entity("nonexistent-id")
    except NotFoundError:
        print("Entity not found")
    except ValidationError as e:
        print(f"Invalid request: {e.message}")
        print(f"Details: {e.details}")
```

| Exception | HTTP Status | Description |
|-----------|-------------|-------------|
| `FederationClientError` | — | Base exception |
| `ConnectionError` | — | Network/timeout |
| `AuthenticationError` | 401, 403 | Auth failure |
| `NotFoundError` | 404 | Resource missing |
| `ValidationError` | 422 | Bad request data |
| `ServerError` | 5xx | Server failure |

---

## Interface Contracts

This package also includes abstract interface definitions for integrating Waldur instances as federation entities. See [INTEGRATION.md](INTEGRATION.md) for implementation guidance.

Available ABCs: `EntityConfigurationBuilder`, `TrustChainResolver`, `FederationAuthMiddleware`, `HasValidTrustChain`, `IdentityBridge`.
