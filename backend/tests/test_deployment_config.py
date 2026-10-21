"""
test_deployment_config.py
Guards the settings behaviour that production deployment depends on.
"""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, normalize_database_url
from app.main import app

client = TestClient(app)


@pytest.mark.parametrize(
    "raw",
    [
        "postgres://user:pw@host:5432/db",
        "postgresql://user:pw@host:5432/db",
    ],
)
def test_managed_postgres_urls_get_the_psycopg_driver(raw):
    """Render, Railway, and Neon all hand out driverless PostgreSQL URLs."""
    assert normalize_database_url(raw) == "postgresql+psycopg://user:pw@host:5432/db"


@pytest.mark.parametrize(
    "raw",
    ["sqlite:///./cyber_deception.db", "postgresql+psycopg://user:pw@host:5432/db"],
)
def test_other_urls_are_left_alone(raw):
    assert normalize_database_url(raw) == raw


def test_settings_expose_the_normalized_url():
    settings = Settings(database_url="postgres://u:p@h:5432/db")
    assert settings.sqlalchemy_url.startswith("postgresql+psycopg://")


def test_development_keeps_the_local_dev_origins():
    settings = Settings(environment="development", frontend_url="https://app.vercel.app")
    origins = settings.cors_origin_list

    assert "https://app.vercel.app" in origins
    assert "http://localhost:5173" in origins


def test_production_uses_only_the_deployed_origins():
    settings = Settings(
        environment="production",
        allowed_origins="https://app.vercel.app,https://preview.vercel.app/",
    )
    origins = settings.cors_origin_list

    assert origins == ["https://app.vercel.app", "https://preview.vercel.app"]
    assert not any("localhost" in origin for origin in origins)


def test_production_without_a_deployed_origin_falls_back_to_the_defaults():
    """A misconfigured deploy must not end up with an empty allow-list silently."""
    settings = Settings(environment="production")
    assert settings.cors_origin_list == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_wildcards_are_never_allowed():
    settings = Settings(environment="production", allowed_origins="*,https://app.vercel.app")
    assert "*" not in settings.cors_origin_list


def test_duplicate_and_trailing_slash_origins_are_collapsed():
    settings = Settings(
        frontend_url="https://app.vercel.app/",
        allowed_origins="https://app.vercel.app",
    )
    assert settings.cors_origin_list.count("https://app.vercel.app") == 1


def test_health_reports_environment_and_database_status():
    response = client.get("/api/health")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["environment"]
    assert body["database"] in {"connected", "unavailable"}


def test_health_needs_no_authentication():
    """Platform health checks hit this endpoint with no headers at all."""
    assert client.get("/api/health", headers={}).status_code == 200
