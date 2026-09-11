"""
planning.py
Defensive planning: forward and backward state-space search.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.planning import PlanRequest, PlanResponse
from app.services import planning_service
from app.services.planning_service import (
    UnknownGoalError,
    UnknownMethodError,
    UnknownNodeError,
)

router = APIRouter(prefix="/planning")


@router.post("/plan", response_model=PlanResponse)
def plan(request: PlanRequest) -> PlanResponse:
    """Builds a defensive plan for the requested goal."""
    try:
        result = planning_service.plan(
            method=request.method.value,
            start_node=request.start_node,
            target_node=request.target_node,
            honeypot_budget=request.honeypot_budget,
            max_depth=request.max_depth,
            goal_type=request.goal_type.value,
        )
    except UnknownNodeError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (UnknownMethodError, UnknownGoalError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return PlanResponse(**result)
