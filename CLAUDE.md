# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Waldur Federation is a multi-tenant SaaS service for coordinating multiple Waldur instances through federation. It enables:
- Instance discovery and registration with Terms of Service workflow
- Live connections between Waldur deployments
- Transaction monitoring across instances
- Health monitoring and alerting

## Architecture

**Backend** (`/backend`): FastAPI with async SQLite (SQLModel/SQLAlchemy)
**Frontend** (`/frontend`): React + TypeScript + Tailwind CSS + Vite

### Backend Structure
- `app/main.py` - FastAPI application with lifespan management
- `app/api/` - Route handlers: federations, instances, connections, monitoring
- `app/models/` - SQLModel ORM: Federation, WaldurInstance, FederationConnection, FederationTransaction, FederationAlert
- `app/services/` - Business logic: waldur_client.py (HTTP client), sync_service.py (health monitoring, transactions, alerts)
- `app/config.py` - Pydantic Settings configuration
- `app/database.py` - Async database setup

### Frontend Structure
- `src/api/client.ts` - Axios client with mock data fallback (VITE_USE_MOCK or dev mode)
- `src/api/types.ts` - TypeScript interfaces matching backend models
- `src/pages/` - Dashboard, Instances, Connections, Monitoring, FederationAdmin
- `src/components/Layout.tsx` - Navigation with federation selector

### API Routes (all prefixed `/api/v1`)
- `/federations/` - Federation CRUD
- `/federations/{slug}/instances/` - Instance registration, approval, ToS acceptance
- `/federations/{slug}/connections/` - Connection management between instances
- `/federations/{slug}/monitoring/` - Transactions, alerts, dashboard stats

## Development Commands

### Backend (uses uv package manager)
```bash
cd backend
uv sync --group dev              # Install dependencies
uv run uvicorn app.main:app --reload  # Dev server on :8000
uv run pytest                    # Run tests
uv run pytest tests/test_federations.py -v  # Single test file
uv run ruff check app tests      # Lint
uv run ruff format app tests     # Format
uv run mypy app                  # Type check
```

### Frontend
```bash
cd frontend
npm install                      # Install dependencies
npm run dev                      # Dev server on :3000 (proxies /api to :8000)
npm run build                    # Production build (tsc + vite build)
npm run type-check               # TypeScript validation
npm run lint                     # ESLint
```

### Docker Compose
```bash
docker-compose up                # Production (backend :8000, frontend :80)
docker-compose --profile dev up  # Development (adds frontend-dev :3000 with hot reload)
```

## Key Patterns

**Mock Data**: Frontend uses mock data by default in development mode. Set `VITE_USE_MOCK=false` to use real API.

**Federation Scoping**: Most API endpoints are scoped under `/federations/{slug}/...` for multi-tenant isolation.

**Async Database**: All database operations use async/await with aiosqlite. Models use SQLModel (Pydantic + SQLAlchemy).

**Connection States**: pending → active ↔ paused → terminated (or failed)

**Instance Lifecycle**: pending → active (after approval + ToS acceptance) → suspended/rejected

## Configuration

Backend environment variables (see `backend/.env.example`):
- `DATABASE_URL` - SQLite connection string
- `CORS_ORIGINS` - Allowed frontend origins
- `DEBUG` - Enable debug mode

Frontend environment:
- `VITE_USE_MOCK` - Use mock data (default: true in dev)
- `VITE_API_URL` - Backend URL (default: /api via Vite proxy)
