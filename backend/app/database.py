from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from app.config import get_settings

settings = get_settings()

# Ensure the SQLite directory exists
_db_url = settings.database_url
if _db_url.startswith("sqlite"):
    _db_path = _db_url.split("///")[-1]
    if _db_path and not _db_path.startswith(":"):
        Path(_db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
)

async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db() -> None:
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session for dependency injection."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
