"""
experiment.py
Request/response schemas for the experiment lab.
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.simulation import SearchAlgorithm


class HoneypotStrategy(str, Enum):
    """Placement strategies an experiment can compare."""

    NONE = "none"
    RANDOM = "random"
    GREEDY = "greedy"
    HILL_CLIMBING = "hill_climbing"
    GENETIC_ALGORITHM = "genetic_algorithm"


class ExperimentRequest(BaseModel):
    """Configuration for one controlled experiment."""

    algorithm: SearchAlgorithm = Field(default=SearchAlgorithm.ASTAR)
    strategy: HoneypotStrategy = Field(default=HoneypotStrategy.GREEDY)
    honeypot_budget: int = Field(default=2, ge=0, le=5)
    runs: int = Field(default=10, ge=1, le=100, description="Repetitions; capped at 100.")
    seed: int = Field(default=0, ge=0, description="Base seed; each run uses seed + index.")
    start_node: str | None = None
    target_node: str | None = None
    compare_strategies: bool = Field(
        default=True, description="Also run every other strategy for comparison."
    )


class ExperimentMetrics(BaseModel):
    """Aggregate outcome of an experiment."""

    total_runs: int
    successful_attacks: int
    intercepted_attacks: int
    deception_success_rate: float
    attack_success_rate: float
    average_path_cost: float
    average_nodes_explored: float
    average_steps: float
    average_execution_ms: float
    average_honeypot_count: float
    average_fitness: float


class StrategyComparison(ExperimentMetrics):
    """Aggregate metrics for one strategy within a comparison."""

    strategy: HoneypotStrategy


class RunSummary(BaseModel):
    """Compact record of a single run."""

    run: int
    seed: int
    outcome: str
    path_cost: int
    nodes_explored: int
    steps: int
    honeypots: list[str]
    honeypot_count: int
    intercepted_at: str | None = None
    fitness: float
    execution_ms: float


class ExperimentResponse(BaseModel):
    """Full experiment report."""

    experiment_id: str
    configuration: dict[str, Any]
    metrics: ExperimentMetrics
    strategy_comparison: list[StrategyComparison] = Field(default_factory=list)
    runs: list[RunSummary]
    truncated_runs: int = Field(
        default=0, description="Runs executed but omitted from the summary list."
    )
    explanation: list[str]
