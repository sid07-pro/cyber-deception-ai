"""
config.py
Application configuration, sourced from environment variables (.env).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Managed PostgreSQL providers (Render, Railway, Neon, Heroku) hand out URLs
# beginning with `postgres://` or `postgresql://`. SQLAlchemy 2 needs an explicit
# driver, and this project installs psycopg 3.
_POSTGRES_PREFIXES = ("postgres://", "postgresql://")
_PSYCOPG_PREFIX = "postgresql+psycopg://"


def normalize_database_url(url: str) -> str:
    """Rewrites a managed-provider PostgreSQL URL to use the psycopg 3 driver."""
    for prefix in _POSTGRES_PREFIXES:
        if url.startswith(prefix):
            return _PSYCOPG_PREFIX + url[len(prefix) :]
    return url


class Settings(BaseSettings):
    """Environment-driven application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "cyber-deception-ai"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_prefix: str = "/api"

    # Comma-separated list of origins allowed to call the API. In production set
    # ALLOWED_ORIGINS (or FRONTEND_URL for a single origin) to the deployed
    # frontend; the local defaults below only cover the Vite dev server.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    allowed_origins: str = ""
    frontend_url: str = ""

    # SQLAlchemy URL. Defaults to a local SQLite file so the API runs without
    # PostgreSQL; Docker Compose supplies a postgresql+psycopg URL instead.
    database_url: str = "sqlite:///./cyber_deception.db"

    @property
    def cors_origin_list(self) -> list[str]:
        """
        Every origin allowed to call the API, from ALLOWED_ORIGINS, FRONTEND_URL,
        and CORS_ORIGINS combined.

        A wildcard is never emitted: with allow_credentials enabled browsers
        reject it anyway, and an open API surface is not wanted in production.
        """
        deployed = ",".join(part for part in (self.allowed_origins, self.frontend_url) if part)
        # In production, an explicit deployed origin replaces the dev defaults
        # rather than being added to them.
        raw = deployed if (self.is_production and deployed) else ",".join(
            part for part in (deployed, self.cors_origins) if part
        )
        origins: list[str] = []
        for origin in raw.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned and cleaned != "*" and cleaned not in origins:
                origins.append(cleaned)
        return origins

    @property
    def sqlalchemy_url(self) -> str:
        """The database URL with a driver SQLAlchemy can actually load."""
        return normalize_database_url(self.database_url)

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (one read of the environment per process)."""
    return Settings()
