# Waldur Federation

A multi-tenant SaaS service for coordinating multiple Waldur instances through federation. Enables Waldur operators to discover, register, and establish dynamic connections with other Waldur deployments.

## Features

- **Instance Discovery** - Register and discover Waldur deployments across organizations
- **Dynamic Connections** - Establish live connections between instances with Terms of Service acceptance workflow
- **Transaction Monitoring** - Track cross-instance transactions in real-time (data sync, resource sharing, API calls)
- **Health Monitoring & Alerting** - Detect connectivity issues, sync failures, and performance degradation

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI, SQLModel, SQLite (async), Python 3.11+ |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Package Managers | uv (Python), npm (Node.js) |
| Containerization | Docker, Docker Compose |
| Deployment | Helm charts for Kubernetes |

## Quick Start

### Using Docker Compose

```bash
# Production mode (backend :8000, frontend :80)
docker-compose up

# Development mode (adds hot-reload frontend on :3000)
docker-compose --profile dev up
```

### Local Development

**Backend:**
```bash
cd backend
uv sync --group dev
uv run uvicorn app.main:app --reload
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:3000
```

The frontend development server proxies `/api` requests to the backend on port 8000.

## Project Structure

```
waldur-federation/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── api/             # Route handlers
│   │   │   ├── federations.py
│   │   │   ├── instances.py
│   │   │   ├── connections.py
│   │   │   └── monitoring.py
│   │   ├── models/          # SQLModel database models
│   │   ├── services/        # Business logic
│   │   ├── config.py        # Configuration
│   │   └── database.py      # Database setup
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/             # API client & types
│   │   ├── pages/           # Page components
│   │   └── components/      # Shared components
│   ├── package.json
│   └── Dockerfile
├── helm/                    # Kubernetes deployment
├── docker-compose.yml
└── CLAUDE.md               # AI assistant guidance
```

## API Overview

All endpoints are prefixed with `/api/v1`. Most resources are scoped under federations for multi-tenant isolation.

| Endpoint | Description |
|----------|-------------|
| `GET /federations/` | List all federations |
| `POST /federations/` | Create a federation |
| `GET /federations/{slug}/instances/` | List instances in federation |
| `POST /federations/{slug}/instances/` | Register an instance |
| `POST /federations/{slug}/instances/{id}/approve` | Approve pending instance |
| `GET /federations/{slug}/connections/` | List connections |
| `POST /federations/{slug}/connections/` | Create connection between instances |
| `GET /federations/{slug}/monitoring/transactions` | List transactions |
| `GET /federations/{slug}/monitoring/alerts` | List alerts |
| `GET /federations/{slug}/monitoring/stats` | Dashboard statistics |
| `GET /health` | Health check |

Interactive API documentation available at `/docs` (Swagger UI) or `/redoc`.

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite connection string | `sqlite+aiosqlite:///./data/federation.db` |
| `CORS_ORIGINS` | Allowed frontend origins (JSON array) | `["http://localhost:3000"]` |
| `DEBUG` | Enable debug mode | `false` |
| `SECRET_KEY` | Application secret key | - |

### Frontend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_USE_MOCK` | Use mock data instead of API | `true` in dev |
| `VITE_API_URL` | Backend API URL | `/api` (proxied) |

## Development

### Running Tests

```bash
# Backend
cd backend
uv run pytest
uv run pytest tests/test_federations.py -v  # Single file
uv run pytest --cov                          # With coverage

# Frontend
cd frontend
npm run type-check
npm run lint
```

### Code Quality

```bash
# Backend
uv run ruff check app tests      # Lint
uv run ruff format app tests     # Format
uv run mypy app                  # Type check

# Frontend
npm run lint -- --fix            # Lint & fix
```

### Building for Production

```bash
# Backend Docker image
docker build -t waldur-federation-backend ./backend

# Frontend Docker image (includes nginx)
docker build -t waldur-federation-frontend ./frontend

# Frontend static build
cd frontend && npm run build     # Output in dist/
```

## Data Models

### Core Entities

- **Federation** - A group of connected Waldur instances with shared policies
- **WaldurInstance** - A registered Waldur deployment (pending → active → suspended)
- **FederationConnection** - A link between two instances (pending → active ↔ paused → terminated)
- **FederationTransaction** - A recorded cross-instance operation
- **FederationAlert** - A system notification (active → acknowledged → resolved)

### Connection Types

- `remote_customer` - Share customer/project data
- `shared_offering` - Share service offerings
- `usage_sync` - Synchronize usage and billing data

## Documentation

- **[User Guide](docs/user-guide.md)** — Comprehensive guide for federation administrators with screenshots covering all pages: Dashboard, Entities, Trust Chain Explorer, Policies, Trust Marks, Keys, and Health.

## License

MIT — see [LICENSE](LICENSE) for details.
