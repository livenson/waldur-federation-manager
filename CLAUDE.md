# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Waldur Federation is an **OpenID Federation 1.0 Trust Anchor** service. It provides cryptographic trust chains, entity discovery, metadata policy enforcement, and trust mark management for coordinating multiple Waldur instances.

Core capabilities:
- Trust Anchor issuing subordinate statements to entities (signed JWTs)
- Trust chain resolution from leaf entities up to the anchor
- Metadata policy enforcement with OIDC Federation operators
- Trust mark definitions and issuance
- Signing key management (ES256/RS256) with rotation

## Architecture

**Backend** (`/backend`): FastAPI + async SQLite (SQLModel/SQLAlchemy) + authlib (JWT/JWK)
**Frontend** (`/frontend`): React 18 + TypeScript + Tailwind CSS + Vite + React Query + @xyflow
**Client library** (`/waldur-federation-client`): Python interface contracts for Waldur integration

### Backend Structure

```
backend/app/
├── main.py                     # FastAPI app, lifespan (DB init, Trust Anchor bootstrap, scheduler)
├── config.py                   # Pydantic Settings (entity_id, key algorithm, intervals)
├── database.py                 # Async SQLite setup (aiosqlite)
├── exceptions.py               # FederationError hierarchy
├── core/
│   ├── models/                 # SQLModel ORM
│   │   ├── entity.py           # Entity (entity_id, status, jwks, authority_hints, country, entity_types)
│   │   ├── statement.py        # SubordinateStatement (issuer→subject, JWT, is_current, expires_at)
│   │   ├── signing_key.py      # SigningKey (kid, algorithm, encrypted private key)
│   │   ├── trust_mark.py       # TrustMarkDefinition + TrustMark (JWT, status)
│   │   ├── metadata_policy.py  # MetadataPolicy (name, entity_type, policy JSON)
│   │   └── waldur_instance.py  # WaldurInstance (federation topology tracking)
│   ├── schemas/                # Pydantic request/response models (entity, statement, policy, trust_mark, topology)
│   └── api/                    # Management REST endpoints (/api/...)
│       ├── entity_management.py    # /api/entities — CRUD, activate, suspend, revoke, rotate-keys
│       ├── statement_management.py # /api/statements — issue, list, regenerate
│       ├── policy_management.py    # /api/policies — CRUD, evaluate compliance
│       ├── trust_mark_management.py # /api/trust-marks — definitions, issue, revoke
│       ├── health.py               # /api/health — dashboard stats, expiring items
│       └── topology.py             # /api/topology — instance registration, topology graph
├── federation/
│   ├── endpoints/              # OpenID Federation 1.0 protocol endpoints
│   │   ├── entity_configuration.py # GET /.well-known/openid-federation
│   │   ├── fetch.py                # GET /federation/fetch?sub=...
│   │   ├── list.py                 # GET /federation/list
│   │   ├── resolve.py              # GET /federation/resolve?sub=...&anchor=...
│   │   ├── historical_keys.py      # GET /federation/historical_keys
│   │   ├── trust_mark_status.py    # POST /federation/trust_mark_status
│   │   └── trust_mark_list.py      # GET /federation/trust_mark_list
│   ├── jwt_builder.py          # Build signed JWTs (entity config, statements, trust marks)
│   ├── jwt_validator.py        # Verify JWT signatures
│   ├── metadata_policy.py      # Policy operators: value, add, default, one_of, subset_of, superset_of, essential
│   ├── trust_chain.py          # Trust chain resolution (local + remote)
│   └── constants.py            # MIME types, entity type constants
├── keys/
│   ├── manager.py              # Key generation, rotation, JWKS building, RFC 7638 thumbprints
│   └── storage.py              # Fernet encryption/decryption of private keys
├── tasks/
│   ├── scheduler.py            # APScheduler setup (statement refresh, expiry monitoring)
│   ├── statement_refresh.py    # Auto-renew expiring statements
│   └── expiry_monitor.py       # Log warnings for near-expiry items
├── notifications/
│   └── notifier.py             # Push notification delivery to registered Waldur instances
└── scenarios/
    ├── router.py               # FastAPI router for listing/running scenarios (debug-only)
    ├── __init__.py             # Scenario registry and @scenario decorator
    ├── schemas.py              # ScenarioMeta, ScenarioStepResult models
    ├── trust_anchor.py         # DB-only trust anchor scenarios
    ├── federation.py           # Scenarios requiring mock Waldur instances
    └── security.py             # Attack vector test scenarios
```

### Frontend Structure

```
frontend/src/
├── App.tsx                     # React Router v6 routes + ManagerRoute guard
├── api/
│   ├── client.ts               # Axios client with mock data fallback
│   ├── types.ts                # TypeScript interfaces matching backend models
│   ├── mockData.ts             # Sample data for development
│   └── queryKeys.ts            # React Query key factory
├── contexts/
│   └── RoleContext.tsx          # Manager/Member role switcher (localStorage-persisted, useRole hook)
├── hooks/                      # React Query hooks
│   ├── useEntities.ts          # Entity CRUD + status transitions
│   ├── useStatements.ts        # Statement queries/mutations
│   ├── usePolicies.ts          # Policy CRUD + evaluate
│   ├── useTrustMarks.ts        # Trust mark definitions + issuance
│   ├── useHealth.ts            # Dashboard stats, expiring items
│   ├── useTrustChainGraph.ts   # Graph layout for visualization
│   ├── useFederation.ts        # Topology API (instances, topology graph)
│   └── useScenarios.ts         # Scenario listing and execution
├── pages/
│   ├── Dashboard.tsx           # Overview: stat cards, federation banner, expiring items, activity, quick actions
│   ├── Entities.tsx            # Entity list with filtering
│   ├── EntityDetail.tsx        # Single entity: overview, statements, trust marks, keys
│   ├── EntityRegister.tsx      # Registration form
│   ├── Federation.tsx          # Federation topology: instance cards, topology graph (@xyflow + Dagre)
│   ├── TrustChainExplorer.tsx  # Interactive trust chain graph (@xyflow + Dagre)
│   ├── Policies.tsx            # Policy list + compliance
│   ├── PolicyEditor.tsx        # Create/edit with JSON editor
│   ├── TrustMarks.tsx          # Define, issue, revoke
│   ├── Keys.tsx                # Key management + rotation history
│   ├── Scenarios.tsx           # Debug scenario runner with step status
│   └── NotFound.tsx
└── components/
    ├── Layout.tsx / Sidebar.tsx    # App shell with grouped navigation (7 items + debug) + role switcher
    ├── DataTable.tsx               # Generic sortable/paginated table
    ├── Modal.tsx / ConfirmDialog.tsx
    ├── StatusBadge.tsx             # Color-coded status chips
    ├── HelpTip.tsx                 # Info tooltips
    ├── JsonEditor.tsx / PolicyBuilder.tsx
    ├── TagInput.tsx                # Multi-value input
    └── flow/                       # Graph components (@xyflow)
        ├── EntityNode.tsx / TrustAnchorNode.tsx
        ├── WaldurInstanceNode.tsx   # Topology graph instance node
        ├── TrustChainEdge.tsx / SubordinateEdge.tsx
        ├── NodeDetailPanel.tsx / EdgeDetailPanel.tsx
        ├── TopologyDetailPanel.tsx  # Federation topology detail panel
        └── useGraphLayout.ts       # Dagre layout algorithm
```

### Routes

**Frontend**: `/` `/federation` `/entities` `/entities/register` `/entities/:id` `/trust-chain` `/policies` `/policies/new` `/policies/:id` `/trust-marks` `/keys` `/scenarios`

**Sidebar navigation** (7 items + debug):
- Dashboard `/`
- Federation: Topology `/federation`, Entities `/entities`, Trust Chain `/trust-chain`
- Governance: Policies `/policies`, Trust Marks `/trust-marks`
- Operations: Keys `/keys`
- Debug (dev only): Scenarios `/scenarios`

**Backend Management API** (prefixed `/api`): entities, statements, policies, trust-marks, health, topology, scenarios

**Federation Protocol**: `/.well-known/openid-federation`, `/federation/fetch`, `/federation/list`, `/federation/resolve`, `/federation/historical_keys`, `/federation/trust_mark_status`, `/federation/trust_mark_list`

## Development Commands

### Backend (uses uv package manager)
```bash
cd backend
uv sync --group dev                           # Install dependencies
uv run uvicorn app.main:app --reload --port 9000  # Dev server on :9000
uv run pytest                                 # Run tests
uv run pytest tests/test_entities.py -v       # Single test file
uv run ruff check app tests                   # Lint
uv run ruff format app tests                  # Format
uv run mypy app                               # Type check
```

### Frontend
```bash
cd frontend
npm install                      # Install dependencies
npm run dev                      # Dev server on :3000 (proxies /api to :9000)
npm run build                    # Production build (tsc + vite build)
npm run type-check               # TypeScript validation (tsc --noEmit)
npm run lint                     # ESLint
```

### Run Script (both services)
```bash
./run.sh start    # Start backend (:9000) + frontend (:3000)
./run.sh stop     # Stop both
./run.sh status   # Check PIDs
./run.sh logs     # Tail logs from .logs/
```

### Docker Compose
```bash
docker-compose up                # Production (backend :9000, frontend :80)
docker-compose --profile dev up  # Development (adds frontend-dev :3000 with hot reload)
```

## Key Patterns

**Mock Data**: Frontend uses mock data by default in dev mode. Set `VITE_USE_MOCK=false` to use real API.

**Async Database**: All DB operations use async/await with aiosqlite. Models use SQLModel (Pydantic + SQLAlchemy). JSON fields for complex data (metadata, policies, JWKS).

**Entity Lifecycle**: draft → active → suspended/revoked. Activation requires signing keys.

**Statement Lifecycle**: Issued with expiry. `is_current` flag tracks latest version. Background task auto-renews.

**Trust Mark Status**: active → revoked (with reason).

**Key Management**: Private keys encrypted with Fernet. Keys identified by JWK Thumbprint (RFC 7638). Rotation creates new key, marks old as ROTATED.

**Trust Chain Resolution**: Walks authority_hints from subject to trust anchor. Supports local DB resolution and remote HTTP federation endpoints. Max depth configurable (default 5).

**Metadata Policy Operators** (OIDC Federation 1.0 spec): `value`, `add`, `default`, `one_of`, `subset_of`, `superset_of`, `essential`.

**Federation Topology**: WaldurInstance model tracks registered Waldur deployments. Topology API builds a graph of instances and their trust anchor relationships. Push notifications sent on lifecycle events (entity activation/suspension/revocation, instance registration/removal).

**Scenarios**: Debug-only (`DEBUG=true`) scenario runner. Scenarios are registered via `@scenario` decorator in `backend/app/scenarios/`. Categories: trust_anchor (DB-only), federation (requires mock instances), security (attack vector tests).

**Role-Based UI**: Frontend-only Manager/Member mode switcher persisted to `localStorage` (`waldur-fed-role`, `waldur-fed-member-entity-id`). `RoleContext` provides `useRole()` hook with `isManager`, `isMember`, `isOwnEntity(id)`. Manager = full access (default). Member = read-only + self-service (rotate own keys). `ManagerRoute` in `App.tsx` redirects members from `/entities/register`, `/policies/new`, `/policies/:id`, `/federation/join`, `/scenarios`. Sidebar hides Scenarios section and adds "My Entity" link in member mode. Each page conditionally hides manager-only buttons via `useRole()`. This is a UI clarity feature, not a security boundary — no backend enforcement.

## Configuration

Backend environment variables (see `backend/.env.example`):
- `DATABASE_URL` — SQLite connection string (default: `sqlite+aiosqlite:///./data/federation.db`)
- `SECRET_KEY` — Used for key encryption
- `DEBUG` — Enable debug mode
- `CORS_ORIGINS` — Allowed frontend origins

Frontend environment:
- `VITE_USE_MOCK` — Use mock data (default: true in dev)
- `VITE_API_URL` — Backend URL (default: /api via Vite proxy)

## Tests

Backend tests in `backend/tests/`:
- `test_entities.py` — Entity CRUD, activation, key rotation
- `test_federation_endpoints.py` — Well-known, fetch, resolve
- `test_jwt.py` — JWT signing and validation
- `test_keys.py` — Key generation, rotation, revocation
- `test_policies.py` — Policy operators, evaluation
- `test_trust_marks.py` — Trust mark definition and issuance

Fixtures in `conftest.py`: async engine, session, TestClient.
