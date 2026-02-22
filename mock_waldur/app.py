"""Mock Waldur Instance — demonstrates OIDC Federation Identity Bridge integration.

Supports running multiple instances with different configs:
  MOCK_WALDUR_INSTANCE_NAME=waldur-csc MOCK_WALDUR_PORT=8001 \
  MOCK_WALDUR_DATABASE_URL=sqlite+aiosqlite:///./mock_waldur/data/waldur-csc.db \
  uvicorn mock_waldur.app:app --port 8001
"""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from mock_waldur.config import get_settings
from mock_waldur.database import init_db
from mock_waldur.models import FederationEntity, MockUser  # noqa: F401 — register models
from mock_waldur.routes import federation_entities, federation_notifications, identity_bridge, users

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    logger.info(
        "%s: database initialized (%s)", settings.instance_name, settings.database_url
    )
    yield


app = FastAPI(
    title=f"Mock Waldur — {settings.instance_name}",
    version="0.1.0",
    description=(
        f"Mock Waldur instance '{settings.instance_name}' demonstrating OIDC Federation "
        "Identity Bridge integration. Receives user attribute pushes authenticated via "
        "federation JWTs and enforces metadata policies from the Trust Anchor."
    ),
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"},
    )


app.include_router(identity_bridge.router)
app.include_router(federation_entities.router)
app.include_router(federation_notifications.router)
app.include_router(users.router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    return {
        "status": "healthy",
        "instance": settings.instance_name,
        "trust_anchors": settings.get_trust_anchors(),
    }


@app.get("/", tags=["Root"])
async def root() -> dict:
    return {
        "name": f"Mock Waldur — {settings.instance_name}",
        "version": "0.1.0",
        "instance": settings.instance_name,
        "trust_anchors": settings.get_trust_anchors(),
        "docs": "/api/docs",
        "endpoints": {
            "identity_bridge": "/api/identity-bridge/",
            "federation_entities": "/api/federation-entities/",
            "federation_notifications": "/api/federation-notifications/",
            "users": "/api/users/",
        },
    }
