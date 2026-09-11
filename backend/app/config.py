"""
config.py
Application configuration, sourced from environment variables (.env).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Comma-separated list of origins allowed to call the API.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # SQLAlchemy URL. Defaults to a local SQLite file so the API runs without
    # PostgreSQL; Docker Compose supplies a postgresql+psycopg URL instead.
    database_url: str = "sqlite:///./cyber_deception.db"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (one read of the environment per process)."""
    return Settings()
