# Waldur Federation

An **OpenID Federation 1.0 Trust Anchor** service for coordinating multiple Waldur instances. Provides cryptographic trust chains, entity discovery, metadata policy enforcement, and trust mark management.

## Features

- **Trust Anchor** — Issue subordinate statements (signed JWTs) to federation entities
- **Trust Chain Resolution** — Walk authority hints from leaf entities up to the anchor
- **Metadata Policy Enforcement** — Apply OIDC Federation 1.0 operators (`essential`, `one_of`, `subset_of`, etc.)
- **Trust Marks** — Define, issue, and revoke trust marks for entity compliance
- **Key Management** — ES256/RS256 signing keys with rotation, encrypted storage, and historical key access
- **Federation Topology** — Register Waldur instances, visualize connectivity, push lifecycle notifications
- **Scenario Runner** — Debug-only test scenarios for federation and security workflows

## Documentation

- **[User Guide](docs/user-guide.md)** — Guide for federation administrators with screenshots covering all pages

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI, SQLModel, SQLite (async via aiosqlite), authlib (JWT/JWK), Python 3.11+ |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite, React Query, @xyflow |
| Package Managers | uv (Python), npm (Node.js) |
| Containerization | Docker, Docker Compose |

## Quick Start

### Using Docker Compose

```bash
# Production (backend :9000, frontend :80)
docker-compose up

# Development (adds frontend-dev :3000 with hot reload)
docker-compose --profile dev up
```

### Local Development

**Backend:**
```bash
cd backend
uv sync --group dev
uv run uvicorn app.main:app --reload --port 9000
# API at http://localhost:9000, docs at http://localhost:9000/docs
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# App at http://localhost:3000 (proxies /api to :9000)
```

**Both at once:**
```bash
./run.sh start    # Start backend (:9000) + frontend (:3000)
./run.sh stop     # Stop both
./run.sh status   # Check PIDs
./run.sh logs     # Tail logs from .logs/
```

## Project Structure

```
waldur-federation/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, Trust Anchor bootstrap
│   │   ├── config.py            # Pydantic Settings
│   │   ├── database.py          # Async SQLite setup
│   │   ├── core/
│   │   │   ├── models/          # SQLModel ORM (entity, statement, signing_key, trust_mark, metadata_policy, waldur_instance)
│   │   │   ├── schemas/         # Pydantic request/response models
│   │   │   └── api/             # Management REST endpoints (/api/...)
│   │   ├── federation/
│   │   │   ├── endpoints/       # OIDC Federation 1.0 protocol endpoints
│   │   │   ├── jwt_builder.py   # Build signed JWTs
│   │   │   ├── jwt_validator.py # Verify JWT signatures
│   │   │   ├── metadata_policy.py # Policy operators
│   │   │   └── trust_chain.py   # Trust chain resolution
│   │   ├── keys/                # Key generation, rotation, encrypted storage
│   │   ├── tasks/               # Background scheduler (statement refresh, expiry monitoring)
│   │   ├── notifications/       # Push notifications for federation lifecycle events
│   │   └── scenarios/           # Debug-only scenario runner
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios client, TypeScript types, mock data, query keys
│   │   ├── hooks/               # React Query hooks (entities, statements, policies, trust marks, health, federation, scenarios)
│   │   ├── pages/               # Dashboard, Entities, Federation, TrustChainExplorer, Policies, TrustMarks, Keys, Health, Scenarios
│   │   └── components/          # Shared UI + flow graph components (@xyflow)
│   ├── package.json
│   └── Dockerfile
├── waldur-federation-client/    # Python client library for Waldur integration
├── docker-compose.yml
├── run.sh
└── CLAUDE.md
```

## API Overview

### Management API (`/api`)

| Endpoint | Description |
|----------|-------------|
| `/api/entities` | Entity CRUD, activate, suspend, revoke, rotate keys |
| `/api/statements` | Issue, list, regenerate subordinate statements |
| `/api/policies` | Policy CRUD, evaluate entity compliance |
| `/api/trust-marks` | Trust mark definitions, issuance, revocation |
| `/api/health` | Dashboard stats, expiring items |
| `/api/topology` | Waldur instance registration and topology graph |
| `/api/scenarios` | List and run debug scenarios (debug mode only) |

### OpenID Federation 1.0 Protocol

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/openid-federation` | Entity configuration (self-signed JWT) |
| `GET /federation/fetch?sub=...` | Fetch subordinate statement |
| `GET /federation/list` | List subordinate entities |
| `GET /federation/resolve?sub=...&anchor=...` | Resolve trust chain |
| `GET /federation/historical_keys` | Historical signing keys |
| `POST /federation/trust_mark_status` | Check trust mark validity |
| `GET /federation/trust_mark_list` | List trust marks for an entity |

Interactive API docs at `/docs` (Swagger UI).

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite connection string | `sqlite+aiosqlite:///./data/federation.db` |
| `SECRET_KEY` | Used for key encryption | — |
| `DEBUG` | Enable debug mode | `false` |
| `CORS_ORIGINS` | Allowed frontend origins | `["http://localhost:3000"]` |

### Frontend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_USE_MOCK` | Use mock data instead of API | `true` in dev |
| `VITE_API_URL` | Backend API URL | `/api` (proxied) |

## Development

### Tests

```bash
cd backend
uv run pytest                            # All tests
uv run pytest tests/test_entities.py -v  # Single file
```

### Code Quality

```bash
# Backend
cd backend
uv run ruff check app tests      # Lint
uv run ruff format app tests     # Format
uv run mypy app                  # Type check

# Frontend
cd frontend
npm run type-check               # TypeScript validation
npm run lint                     # ESLint
```

### Building for Production

```bash
docker build -t waldur-federation-backend ./backend
docker build -t waldur-federation-frontend ./frontend

# Or just the frontend static build
cd frontend && npm run build     # Output in dist/
```

## Data Models

- **Entity** — A federation participant (draft → active → suspended → revoked)
- **SubordinateStatement** — Signed JWT from issuer to subject with metadata policy, override, and constraints
- **SigningKey** — ES256/RS256 key pair, encrypted at rest, identified by JWK Thumbprint (RFC 7638)
- **TrustMarkDefinition / TrustMark** — Compliance marks issued to entities (active → revoked)
- **MetadataPolicy** — Named policy with OIDC Federation operators applied per entity type
- **WaldurInstance** — A registered Waldur deployment for federation topology tracking

## License

MIT — see [LICENSE](LICENSE) for details.
