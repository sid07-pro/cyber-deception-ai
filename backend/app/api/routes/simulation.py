"""
simulation.py
Runs attacker-vs-defender simulations over the network.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.simulation import SimulationRequest, SimulationResponse
from app.services import persistence_service, simulation_service
from app.services.persistence_service import ScenarioNotFoundError
from app.services.simulation_service import UnknownNodeError, UnsupportedAlgorithmError

router = APIRouter()


def _load_scenario(scenario_id: int, db: Session) -> dict:
    try:
        return persistence_service.scenario_to_dict(persistence_service.get_scenario(db, scenario_id))
    except ScenarioNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc.args[0])) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable, so saved scenarios cannot be loaded.",
        ) from exc


@router.post("/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest, db: Session = Depends(get_db)) -> SimulationResponse:
    """Predicts the attacker's path, places honeypots, and reports the outcome."""
    scenario = _load_scenario(request.scenario_id, db) if request.scenario_id is not None else None
    try:
        result = simulation_service.run_simulation(
            algorithm=request.algorithm.value,
            start_node=request.start_node,
            target_node=request.target_node,
            honeypot_count=request.honeypot_count,
            scenario=scenario,
        )
    except UnknownNodeError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedAlgorithmError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return SimulationResponse(**result)
