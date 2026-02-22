"""Waldur Federation — OpenID Federation 1.0 Trust Anchor Service."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.core.models import (  # noqa: F401 — ensure all models are registered
    Entity,
    MetadataPolicy,
    SigningKey,
    SubordinateStatement,
    TrustMark,
    TrustMarkDefinition,
)
from app.database import init_db
from app.exceptions import FederationError

# Management API
from app.core.api import entity_management, health, policy_management
from app.core.api import statement_management, trust_mark_management

# Federation protocol endpoints
from app.federation.endpoints import (
    entity_configuration,
    fetch,
    historical_keys,
    list as federation_list,
    resolve,
    trust_mark_list,
    trust_mark_status,
)

from app.tasks.scheduler import scheduler, setup_scheduler

logger = logging.getLogger(__name__)
settings = get_settings()


async def _ensure_trust_anchor(session) -> None:
    """Ensure the Trust Anchor entity exists with signing keys."""
    from sqlalchemy import select
    from app.core.models.entity import Entity, EntityStatus
    from app.core.models.signing_key import KeyAlgorithm
    from app.keys.manager import generate_key, get_active_key, get_entity_jwks
    import json

    result = await session.execute(
        select(Entity).where(Entity.entity_id == settings.entity_id)
    )
    ta = result.scalars().first()

    if not ta:
        ta = Entity(
            entity_id=settings.entity_id,
            name="Trust Anchor",
            organization="Waldur Federation",
            entity_types=json.dumps(["federation_entity"]),
            status=EntityStatus.ACTIVE,
            entity_metadata=json.dumps({
                "federation_entity": {
                    "organization_name": "Waldur Federation",
                }
            }),
        )
        session.add(ta)
        await session.commit()
        await session.refresh(ta)
        logger.info("Created Trust Anchor entity: %s", settings.entity_id)

    # Ensure signing key exists
    key = await get_active_key(session, ta.id)
    if not key:
        algo = KeyAlgorithm(settings.default_key_algorithm)
        key = await generate_key(session, ta.id, algo)
        logger.info("Generated signing key for Trust Anchor: kid=%s", key.kid)

    # Update JWKS
    jwks = await get_entity_jwks(session, ta.id)
    ta.jwks = json.dumps(jwks)
    session.add(ta)
    await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    await init_db()

    # Ensure Trust Anchor exists
    from app.database import async_session

    async with async_session() as session:
        await _ensure_trust_anchor(session)

    # Start background scheduler
    sched = setup_scheduler()
    sched.start()
    logger.info("Background scheduler started")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    logger.info("Background scheduler stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "OpenID Federation 1.0 Trust Anchor service for Waldur federation management. "
        "Provides cryptographic trust chains, entity discovery, metadata policy "
        "enforcement, and trust mark management."
    ),
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler for FederationError
@app.exception_handler(FederationError)
async def federation_error_handler(request: Request, exc: FederationError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message},
    )


# --- Federation Protocol Endpoints (OpenID Federation 1.0) ---
app.include_router(entity_configuration.router, tags=["Federation Protocol"])
app.include_router(fetch.router, tags=["Federation Protocol"])
app.include_router(federation_list.router, tags=["Federation Protocol"])
app.include_router(resolve.router, tags=["Federation Protocol"])
app.include_router(historical_keys.router, tags=["Federation Protocol"])
app.include_router(trust_mark_status.router, tags=["Federation Protocol"])
app.include_router(trust_mark_list.router, tags=["Federation Protocol"])

# --- Management API ---
app.include_router(entity_management.router)
app.include_router(policy_management.router)
app.include_router(statement_management.router)
app.include_router(trust_mark_management.router)
app.include_router(health.router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "version": settings.app_version}


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    """Root endpoint with API information."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "type": "OpenID Federation 1.0 Trust Anchor",
        "entity_id": settings.entity_id,
        "docs": "/api/docs",
        "openapi": "/api/openapi.json",
        "well_known": "/.well-known/openid-federation",
    }
