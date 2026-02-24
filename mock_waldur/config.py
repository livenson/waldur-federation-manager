"""Settings for the mock Waldur instance.

Supports multiple instances via MOCK_WALDUR_ prefixed env vars.
Each instance should set its own instance_name, port, and database_url.

Example:
  MOCK_WALDUR_INSTANCE_NAME=waldur-csc MOCK_WALDUR_PORT=9501 \
  MOCK_WALDUR_DATABASE_URL=sqlite+aiosqlite:///./mock_waldur/data/waldur-csc.db \
  uvicorn mock_waldur.app:app --port 9501
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class MockSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MOCK_WALDUR_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    instance_name: str = "mock-waldur"
    database_url: str = "sqlite+aiosqlite:///./mock_waldur/data/mock.db"
    jwks_cache_ttl_seconds: int = 3600
    policy_cache_ttl_seconds: int = 86400
    default_trust_anchor_url: str = "http://localhost:9000"
    # Comma-separated list of Trust Anchor URLs for multi-federation scenarios
    trust_anchor_urls: str = ""
    port: int = 9500
    debug: bool = False

    def get_trust_anchors(self) -> list[str]:
        """Return list of all Trust Anchor URLs this instance participates in."""
        anchors = [self.default_trust_anchor_url]
        if self.trust_anchor_urls:
            for url in self.trust_anchor_urls.split(","):
                url = url.strip()
                if url and url not in anchors:
                    anchors.append(url)
        return anchors


@lru_cache
def get_settings() -> MockSettings:
    return MockSettings()
