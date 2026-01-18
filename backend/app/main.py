"""Waldur Federation SaaS - FastAPI Application."""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.api import federations, instances, connections, monitoring

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    await init_db()
    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Multi-tenant SaaS service for federation of Waldur instances. "
        "Enables Waldur operators to discover, register, and establish "
        "dynamic connections with other Waldur deployments. Provides "
        "monitoring of cross-instance transactions and alerting."
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

# Include routers
app.include_router(
    federations.router,
    prefix=f"{settings.api_v1_prefix}/federations",
    tags=["Federations"],
)

app.include_router(
    instances.router,
    prefix=f"{settings.api_v1_prefix}/federations",
    tags=["Instances"],
)

app.include_router(
    connections.router,
    prefix=f"{settings.api_v1_prefix}/federations",
    tags=["Connections"],
)

app.include_router(
    monitoring.router,
    prefix=f"{settings.api_v1_prefix}/federations",
    tags=["Monitoring"],
)


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
        "docs": "/api/docs",
        "openapi": "/api/openapi.json",
    }
