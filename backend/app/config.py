from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings for OpenID Federation Trust Anchor."""

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

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # OpenID Federation Trust Anchor
    entity_id: str = "https://federation.waldur.example.com"
    secret_key: str = "change-me-in-production"
    default_statement_lifetime_seconds: int = 604800  # 7 days
    default_key_algorithm: str = "ES256"
    trust_chain_max_depth: int = 5

    # Background tasks
    statement_refresh_interval_hours: int = 24
    expiry_warning_days: int = 3


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
