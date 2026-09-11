"""
experiments.py
Experiment lab: repeated simulations and strategy comparison.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.experiment import ExperimentRequest, ExperimentResponse
from app.services import experiment_service
from app.services.experiment_service import (
    ExperimentNotFoundError,
    InvalidExperimentError,
)

router = APIRouter(prefix="/experiments")


@router.post("/run", response_model=ExperimentResponse)
def run(request: ExperimentRequest) -> ExperimentResponse:
    """Runs a bounded batch of simulations and returns the aggregated report."""
    try:
        experiment = experiment_service.run_experiment(
            algorithm=request.algorithm.value,
            strategy=request.strategy.value,
            honeypot_budget=request.honeypot_budget,
            runs=request.runs,
            seed=request.seed,
            start_node=request.start_node,
            target_node=request.target_node,
            compare_strategies=request.compare_strategies,
        )
    except InvalidExperimentError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return ExperimentResponse(**experiment)


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get(experiment_id: str) -> ExperimentResponse:
    """Returns a previously run experiment from the in-memory store."""
    try:
        experiment = experiment_service.get_experiment(experiment_id)
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'")
        ) from exc

    return ExperimentResponse(**experiment)
