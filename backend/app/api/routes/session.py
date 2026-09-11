"""
session.py
Stepped simulation sessions: start, advance, reset.

Sessions live in process memory only (see app.services.session_store).
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.session import (
    SessionRequest,
    SimulationStateResponse,
    StartSimulationRequest,
)
from app.services import deception_engine
from app.services.deception_engine import UnknownNodeError
from app.services.session_store import SessionNotFoundError

router = APIRouter(prefix="/simulation")


def _not_found(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'"))


@router.post("/start", response_model=SimulationStateResponse)
def start(request: StartSimulationRequest) -> SimulationStateResponse:
    """Plans the attack, places honeypots, and returns the session at step 0."""
    try:
        state = deception_engine.start_simulation(
            algorithm=request.algorithm.value,
            start_node=request.start_node,
            target_node=request.target_node,
            honeypot_budget=request.honeypot_budget,
        )
    except UnknownNodeError as exc:
        raise _not_found(exc) from exc

    return SimulationStateResponse(**state.to_dict())


@router.post("/step", response_model=SimulationStateResponse)
def step(request: SessionRequest) -> SimulationStateResponse:
    """Advances the attacker one hop. Completed sessions are returned unchanged."""
    try:
        state = deception_engine.step_simulation(request.session_id)
    except SessionNotFoundError as exc:
        raise _not_found(exc) from exc

    return SimulationStateResponse(**state.to_dict())


@router.post("/reset", response_model=SimulationStateResponse)
def reset(request: SessionRequest) -> SimulationStateResponse:
    """Rewinds the session to step 0, keeping its configuration."""
    try:
        state = deception_engine.reset_simulation(request.session_id)
    except SessionNotFoundError as exc:
        raise _not_found(exc) from exc

    return SimulationStateResponse(**state.to_dict())
