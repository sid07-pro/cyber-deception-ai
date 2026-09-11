"""
scenarios.py
Persistence endpoints: saved network scenarios and stored experiment history.

Database failures answer 503 rather than a bare 500, so the frontend can tell a
missing database apart from a bad request.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.scenario import (
    SaveCurrentNetworkRequest,
    SaveExperimentRequest,
    ScenarioCreateRequest,
    ScenarioResponse,
    ScenarioSummary,
    StoredExperimentResponse,
    StoredExperimentSummary,
)
from app.services import experiment_service, persistence_service
from app.services.experiment_service import ExperimentNotFoundError
from app.services.persistence_service import (
    DuplicateScenarioError,
    InvalidScenarioError,
    ScenarioNotFoundError,
    StoredExperimentNotFoundError,
)

router = APIRouter()

DB_UNAVAILABLE = "The database is unavailable. Check DATABASE_URL and that the server is running."


def _unavailable(exc: SQLAlchemyError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=DB_UNAVAILABLE)


# ---- Scenarios ----

@router.post("/scenarios", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
def create_scenario(
    request: ScenarioCreateRequest, db: Session = Depends(get_db)
) -> ScenarioResponse:
    """Saves a network scenario."""
    try:
        scenario = persistence_service.create_scenario(db, request.model_dump())
    except DuplicateScenarioError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InvalidScenarioError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except SQLAlchemyError as exc:
        raise _unavailable(exc) from exc

    return ScenarioResponse(**persistence_service.scenario_to_dict(scenario))


@router.post(
    "/scenarios/save-current",
    response_model=ScenarioResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_current_network(
    request: SaveCurrentNetworkRequest, db: Session = Depends(get_db)
) -> ScenarioResponse:
    """Saves the built-in network under a new name."""
    payload = persistence_service.snapshot_of_builtin_network(request.name, request.description)
    try:
        scenario = persistence_service.create_scenario(db, payload)
    except DuplicateScenarioError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise _unavailable(exc) from exc

    return ScenarioResponse(**persistence_service.scenario_to_dict(scenario))


@router.get("/scenarios", response_model=list[ScenarioSummary])
def list_scenarios(db: Session = Depends(get_db)) -> list[ScenarioSummary]:
    """Saved scenarios, newest first. An empty list is a valid answer."""
    try:
        scenarios = persistence_service.list_scenarios(db)
    except SQLAlchemyError as exc:
        raise _unavailable(exc) from exc

    return [
        ScenarioSummary(
            id=scenario.id,
            name=scenario.name,
            description=scenario.description,
            attacker_start=scenario.attacker_start,
            critical_target=scenario.critical_target,
            created_at=scenario.created_at,
            node_count=len(scenario.nodes),
            edge_count=len(scenario.edges),
            experiment_count=len(scenario.experiments),
        )
        for scenario in scenarios
    ]


@router.get("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def get_scenario(scenario_id: int, db: Session = Depends(get_db)) -> ScenarioResponse:
    """One saved scenario, with its nodes and edges."""
    try:
        scenario = persistence_service.get_scenario(db, scenario_id)
    except ScenarioNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'")
        ) from exc
    except SQLAlchemyError as exc:
        raise _unavailable(exc) from exc

    return ScenarioResponse(**persistence_service.scenario_to_dict(scenario))


@router.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)) -> None:
    """Deletes a scenario together with its nodes, edges, and stored experiments."""
    try:
        persistence_service.delete_scenario(db, scenario_id)
    except ScenarioNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'")
        ) from exc
    except SQLAlchemyError as exc:
        raise _unavailable(exc) from exc


# ---- Stored experiments ----

@router.post(
    "/experiments/save",
    response_model=StoredExperimentResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_experiment(
    request: SaveExperimentRequest, db: Session = Depends(get_db)
) -> StoredExperimentResponse:
    """Persists an experiment that is still in the in-memory store."""
    try:
        experiment = experiment_service.get_experiment(request.experiment_id)
    except ExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'")
        ) from exc

    try:
        record = persistence_service.save_experiment(db, experiment, request.scenario_id)
    except ScenarioNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'")
        ) from exc
    except SQLAlchemyError as exc:
        raise _unavailable(exc) from exc

    return StoredExperimentResponse(**persistence_service.experiment_to_dict(record))


@router.get("/experiments-history", response_model=list[StoredExperimentSummary])
def list_stored_experiments(
    limit: int = Query(default=25, ge=1, le=100), db: Session = Depends(get_db)
) -> list[StoredExperimentSummary]:
    """Persisted experiments, newest first."""
    try:
        records = persistence_service.list_experiments(db, limit)
    except SQLAlchemyError as exc:
        raise _unavailable(exc) from exc

    return [
        StoredExperimentSummary(
            experiment_id=record.experiment_id,
            scenario_id=record.scenario_id,
            created_at=record.created_at,
            algorithm=record.algorithm,
            strategy=record.strategy,
            honeypot_budget=record.honeypot_budget,
            runs=record.runs,
            seed=record.seed,
            deception_success_rate=(record.metrics or {}).get("deception_success_rate", 0.0),
            attack_success_rate=(record.metrics or {}).get("attack_success_rate", 0.0),
        )
        for record in records
    ]


@router.get("/experiments-history/{experiment_id}", response_model=StoredExperimentResponse)
def get_stored_experiment(
    experiment_id: str, db: Session = Depends(get_db)
) -> StoredExperimentResponse:
    """One persisted experiment report."""
    try:
        record = persistence_service.get_experiment(db, experiment_id)
    except StoredExperimentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'")
        ) from exc
    except SQLAlchemyError as exc:
        raise _unavailable(exc) from exc

    return StoredExperimentResponse(**persistence_service.experiment_to_dict(record))
