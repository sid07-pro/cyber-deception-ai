"""
scenario.py
Request/response schemas for saved scenarios and stored experiments.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.experiment import ExperimentMetrics, RunSummary, StrategyComparison
from app.schemas.network import NetworkEdge, NetworkNode


class ScenarioCreateRequest(BaseModel):
    """A network topology to save."""

    name: str = Field(min_length=1, max_length=120, description="Unique scenario name.")
    description: str = Field(default="", max_length=2000)
    attacker_start: str = Field(description="Must be one of the supplied nodes.")
    critical_target: str = Field(description="Must be one of the supplied nodes, and differ from the start.")
    nodes: list[NetworkNode] = Field(min_length=1)
    edges: list[NetworkEdge] = Field(default_factory=list)


class SaveCurrentNetworkRequest(BaseModel):
    """Saves the built-in network without the client having to re-send it."""

    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)


class ScenarioResponse(BaseModel):
    """A saved scenario, shaped like GET /api/network plus its identity."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    attacker_start: str
    critical_target: str
    created_at: datetime
    nodes: list[NetworkNode]
    edges: list[NetworkEdge]
    honeypot_candidates: list[str]
    experiment_count: int = 0


class ScenarioSummary(BaseModel):
    """Compact row for the saved-scenario list."""

    id: int
    name: str
    description: str
    attacker_start: str
    critical_target: str
    created_at: datetime
    node_count: int
    edge_count: int
    experiment_count: int


class SaveExperimentRequest(BaseModel):
    """Persists an experiment that has already been run."""

    experiment_id: str = Field(description="Id returned by POST /api/experiments/run.")
    scenario_id: int | None = Field(
        default=None, description="Optional scenario to attach the experiment to."
    )


class StoredExperimentResponse(BaseModel):
    """A persisted experiment report."""

    experiment_id: str
    scenario_id: int | None = None
    created_at: datetime
    configuration: dict[str, Any]
    metrics: ExperimentMetrics
    strategy_comparison: list[StrategyComparison] = Field(default_factory=list)
    runs: list[RunSummary] = Field(default_factory=list)
    truncated_runs: int = 0
    explanation: list[str] = Field(default_factory=list)


class StoredExperimentSummary(BaseModel):
    """Compact row for the experiment history list."""

    experiment_id: str
    scenario_id: int | None = None
    created_at: datetime
    algorithm: str
    strategy: str
    honeypot_budget: int
    runs: int
    seed: int
    deception_success_rate: float
    attack_success_rate: float
