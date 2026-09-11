"""
router.py
Aggregates all API route modules under a single router.
"""

from fastapi import APIRouter

from app.api.routes import health, network, session, simulation

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(network.router, tags=["network"])
api_router.include_router(simulation.router, tags=["simulation"])
api_router.include_router(session.router, tags=["simulation-session"])
