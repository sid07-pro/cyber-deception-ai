"""
health.py
Liveness endpoint used by the frontend to confirm backend connectivity.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings, get_settings
from app.db.session import engine
from app.schemas.health import HealthResponse

router = APIRouter()


def _database_status() -> str:
    """Reports whether the database answers, without failing the health check."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return "unavailable"
    return "connected"


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """
    Reports that the API is up, identifies the service, and states whether the
    database is reachable.

    Always returns 200 so platform health checks stay green while the database
    is still starting; inspect the `database` field to tell the two apart.
    """
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        database=_database_status(),
    )
