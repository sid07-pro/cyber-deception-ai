"""
router.py
Aggregates all API route modules under a single router.
"""

from fastapi import APIRouter

from app.api.routes import (
    ai,
    experiments,
    health,
    network,
    planning,
    session,
    simulation,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(network.router, tags=["network"])
api_router.include_router(simulation.router, tags=["simulation"])
api_router.include_router(session.router, tags=["simulation-session"])
api_router.include_router(ai.router, tags=["advanced-ai"])
api_router.include_router(planning.router, tags=["planning"])
api_router.include_router(experiments.router, tags=["experiments"])
