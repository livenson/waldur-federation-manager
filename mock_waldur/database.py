"""Async SQLite database setup for the mock Waldur instance.

Uses lazy initialization so each instance gets its own engine based on settings.
"""

from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from mock_waldur.config import get_settings

_engine = None
_async_session = None


def _get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        db_url = settings.database_url
        if db_url.startswith("sqlite"):
            db_path = db_url.split("///")[-1]
            if db_path and not db_path.startswith(":"):
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        _engine = create_async_engine(db_url, echo=settings.debug, future=True)
    return _engine


def _get_session_factory():
    global _async_session
    if _async_session is None:
        _async_session = sessionmaker(
            _get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _async_session


async def init_db() -> None:
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    factory = _get_session_factory()
    async with factory() as session:
        try:
            yield session
        finally:
            await session.close()
