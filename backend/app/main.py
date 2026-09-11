"""
main.py
FastAPI application entry point for the Cyber Deception AI backend.

Everything served here is a safe, fully simulated environment — no real
hosts, exploitation, or offensive cybersecurity functionality exists.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config import get_settings
from app.db.session import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Creates missing tables at boot.

    A failure here is logged rather than fatal: every simulation and AI endpoint
    works without a database, and the persistence endpoints answer 503 until one
    is reachable.
    """
    try:
        init_db()
    except Exception as exc:  # noqa: BLE001 - startup must not crash the API
        logger.warning("Database unavailable at startup: %s", exc)
    yield


def create_app() -> FastAPI:
    """Builds and configures the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Cyber Deception AI",
        description=(
            "AI-based cyber deception simulation for intelligent honeypot "
            "placement and attacker path prediction. Simulation only."
        ),
        version=settings.app_version,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
