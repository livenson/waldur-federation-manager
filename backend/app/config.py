from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Waldur Federation"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/federation.db"

    # API
    api_v1_prefix: str = "/api/v1"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Security
    secret_key: str = "change-me-in-production"

    # Sync settings
    sync_interval_minutes: int = 60
    sync_timeout_seconds: int = 300

    # Export settings
    export_max_offerings: int = 1000


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
