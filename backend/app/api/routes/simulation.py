"""
simulation.py
Runs attacker-vs-defender simulations over the network.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.services import simulation_service
from app.services.simulation_service import UnknownNodeError, UnsupportedAlgorithmError

router = APIRouter()


@router.post("/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest) -> SimulationResponse:
    """Predicts the attacker's path, places honeypots, and reports the outcome."""
    try:
        result = simulation_service.run_simulation(
            algorithm=request.algorithm.value,
            start_node=request.start_node,
            target_node=request.target_node,
            honeypot_count=request.honeypot_count,
        )
    except UnknownNodeError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedAlgorithmError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return SimulationResponse(**result)
