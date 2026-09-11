"""
persistence_service.py
Reads and writes saved scenarios and completed experiments.

Takes a SQLAlchemy session from the caller, so the API layer owns the request
scope and the tests can pass a SQLite session. No HTTP concerns here.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.scenario import ExperimentRecord, Scenario, ScenarioEdge, ScenarioNode
from app.services.simulation_service import get_network


class ScenarioNotFoundError(KeyError):
    """Raised when a scenario id does not exist."""

    def __init__(self, scenario_id: int) -> None:
        super().__init__(f"No scenario with id {scenario_id}.")
        self.scenario_id = scenario_id


class DuplicateScenarioError(ValueError):
    """Raised when a scenario name is already taken."""

    def __init__(self, name: str) -> None:
        super().__init__(f"A scenario named '{name}' already exists.")
        self.name = name


class InvalidScenarioError(ValueError):
    """Raised when a scenario's nodes and edges do not form a usable network."""


class StoredExperimentNotFoundError(KeyError):
    """Raised when a stored experiment id does not exist."""

    def __init__(self, experiment_id: str) -> None:
        super().__init__(f"No stored experiment with id '{experiment_id}'.")
        self.experiment_id = experiment_id


# ---- Scenarios ----

def _validate(payload: dict[str, Any]) -> None:
    node_ids = {node["id"] for node in payload["nodes"]}
    if not node_ids:
        raise InvalidScenarioError("A scenario needs at least one node.")
    if len(node_ids) != len(payload["nodes"]):
        raise InvalidScenarioError("Node identifiers must be unique.")

    for edge in payload["edges"]:
        for endpoint in (edge["source"], edge["target"]):
            if endpoint not in node_ids:
                raise InvalidScenarioError(f"Edge endpoint '{endpoint}' is not a known node.")
        if edge["weight"] <= 0:
            raise InvalidScenarioError("Edge weights must be positive.")

    for field in ("attacker_start", "critical_target"):
        if payload[field] not in node_ids:
            raise InvalidScenarioError(f"{field} '{payload[field]}' is not a known node.")
    if payload["attacker_start"] == payload["critical_target"]:
        raise InvalidScenarioError("The attacker start and the critical target must differ.")


def create_scenario(session: Session, payload: dict[str, Any]) -> Scenario:
    """Saves a scenario and returns it. Raises on a duplicate name or bad topology."""
    _validate(payload)

    existing = session.scalar(select(Scenario).where(Scenario.name == payload["name"]))
    if existing is not None:
        raise DuplicateScenarioError(payload["name"])

    scenario = Scenario(
        name=payload["name"],
        description=payload.get("description", ""),
        attacker_start=payload["attacker_start"],
        critical_target=payload["critical_target"],
        nodes=[
            ScenarioNode(
                node_id=node["id"],
                name=node["name"],
                type=node["type"],
                criticality=node["criticality"],
                node_metadata=node.get("metadata", {}),
            )
            for node in payload["nodes"]
        ],
        edges=[
            ScenarioEdge(source=edge["source"], target=edge["target"], weight=edge["weight"])
            for edge in payload["edges"]
        ],
    )

    session.add(scenario)
    session.commit()
    session.refresh(scenario)
    return scenario


def snapshot_of_builtin_network(name: str, description: str = "") -> dict[str, Any]:
    """Builds a save payload from the built-in network, so the UI can save it as-is."""
    network = get_network()
    return {
        "name": name,
        "description": description,
        "attacker_start": network["attacker_start"],
        "critical_target": network["critical_target"],
        "nodes": network["nodes"],
        "edges": network["edges"],
    }


def list_scenarios(session: Session) -> list[Scenario]:
    """Newest first."""
    return list(session.scalars(select(Scenario).order_by(Scenario.created_at.desc(), Scenario.id.desc())))


def get_scenario(session: Session, scenario_id: int) -> Scenario:
    scenario = session.get(Scenario, scenario_id)
    if scenario is None:
        raise ScenarioNotFoundError(scenario_id)
    return scenario


def delete_scenario(session: Session, scenario_id: int) -> None:
    """Deletes a scenario and, by cascade, its nodes, edges, and experiments."""
    scenario = get_scenario(session, scenario_id)
    session.delete(scenario)
    session.commit()


def scenario_to_dict(scenario: Scenario) -> dict[str, Any]:
    """Shapes a scenario the same way GET /api/network does, plus its identity."""
    return {
        "id": scenario.id,
        "name": scenario.name,
        "description": scenario.description,
        "attacker_start": scenario.attacker_start,
        "critical_target": scenario.critical_target,
        "created_at": scenario.created_at,
        "nodes": [
            {
                "id": node.node_id,
                "name": node.name,
                "type": node.type,
                "criticality": node.criticality,
                "metadata": node.node_metadata or {},
            }
            for node in scenario.nodes
        ],
        "edges": [
            {"source": edge.source, "target": edge.target, "weight": edge.weight}
            for edge in scenario.edges
        ],
        "honeypot_candidates": [
            node.node_id
            for node in scenario.nodes
            if node.node_id not in {scenario.attacker_start, scenario.critical_target}
        ],
        "experiment_count": len(scenario.experiments),
    }


# ---- Experiments ----

def save_experiment(
    session: Session, experiment: dict[str, Any], scenario_id: int | None = None
) -> ExperimentRecord:
    """Persists a completed experiment report."""
    if scenario_id is not None:
        get_scenario(session, scenario_id)  # raises if missing

    configuration = experiment["configuration"]
    record = ExperimentRecord(
        experiment_id=experiment["experiment_id"],
        scenario_id=scenario_id,
        algorithm=configuration["algorithm"],
        strategy=configuration["strategy"],
        honeypot_budget=configuration["honeypot_budget"],
        runs=configuration["runs"],
        seed=configuration["seed"],
        configuration=configuration,
        metrics=experiment["metrics"],
        strategy_comparison=experiment.get("strategy_comparison", []),
        run_summaries=experiment.get("runs", []),
        explanation=experiment.get("explanation", []),
    )

    session.add(record)
    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise
    session.refresh(record)
    return record


def list_experiments(session: Session, limit: int = 25) -> list[ExperimentRecord]:
    """Newest first, capped so the response stays small."""
    statement = (
        select(ExperimentRecord)
        .order_by(ExperimentRecord.created_at.desc(), ExperimentRecord.id.desc())
        .limit(max(1, min(limit, 100)))
    )
    return list(session.scalars(statement))


def get_experiment(session: Session, experiment_id: str) -> ExperimentRecord:
    record = session.scalar(
        select(ExperimentRecord).where(ExperimentRecord.experiment_id == experiment_id)
    )
    if record is None:
        raise StoredExperimentNotFoundError(experiment_id)
    return record


def experiment_to_dict(record: ExperimentRecord) -> dict[str, Any]:
    return {
        "experiment_id": record.experiment_id,
        "scenario_id": record.scenario_id,
        "created_at": record.created_at,
        "configuration": record.configuration,
        "metrics": record.metrics,
        "strategy_comparison": record.strategy_comparison or [],
        "runs": record.run_summaries or [],
        "truncated_runs": max(0, record.runs - len(record.run_summaries or [])),
        "explanation": record.explanation or [],
    }
