"""
network.py
Exposes the simulated network topology.
"""

from fastapi import APIRouter

from app.schemas.network import NetworkResponse
from app.services import simulation_service

router = APIRouter()


@router.get("/network", response_model=NetworkResponse)
def get_network() -> NetworkResponse:
    """Returns the nodes, edges, and scenario reference points of the network."""
    return NetworkResponse(**simulation_service.get_network())
