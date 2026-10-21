"""
simulation.py
Request/response schemas for running an attacker-vs-defender simulation.
"""

from enum import Enum

from pydantic import BaseModel, Field


class SearchAlgorithm(str, Enum):
    """Search strategies the attacker agent can use (all already implemented in `ai/`)."""

    BFS = "BFS"
    DFS = "DFS"
    UCS = "UCS"
    ASTAR = "A*"


class SimulationOutcome(str, Enum):
    """Result of the attacker-defender interaction."""

    INTERCEPTED = "intercepted"
    TARGET_REACHED = "target_reached"
    NO_PATH = "no_path"


class SimulationRequest(BaseModel):
    """Parameters for a single simulation run."""

    algorithm: SearchAlgorithm = Field(
        default=SearchAlgorithm.ASTAR,
        description="Search strategy the attacker agent uses to choose its path.",
    )
    start_node: str | None = Field(
        default=None,
        description="Attacker entry point. Defaults to the scenario's attacker start.",
    )
    target_node: str | None = Field(
        default=None,
        description="Asset the attacker is seeking. Defaults to the scenario's critical target.",
    )
    honeypot_count: int = Field(
        default=2,
        ge=0,
        le=5,
        description="How many honeypots the defender agent deploys.",
    )
    scenario_id: int | None = Field(
        default=None,
        ge=1,
        description="Run on a saved scenario's topology instead of the built-in network.",
    )


class HoneypotScore(BaseModel):
    """One row of the defender's transparent deception-scoring table."""

    node: str
    attack_path_frequency: int
    target_proximity: float
    node_connectivity: int
    deployment_cost: int
    deception_score: float
    selected: bool = Field(description="Whether a honeypot was actually deployed here.")


class AlgorithmComparison(BaseModel):
    """Result of one search algorithm, for the side-by-side comparison table."""

    algorithm: str
    path: list[str]
    cost: int
    nodes_explored: int


class AlternativePath(BaseModel):
    """One of the cheapest loop-free routes, ranked by total edge cost."""

    rank: int = Field(description="1 is the cheapest route.")
    path: list[str]
    cost: int
    hops: int
    honeypots_on_path: list[str] = Field(
        description="Deployed honeypots this route passes through, in order."
    )
    intercepted: bool = Field(description="Whether this route would hit a deployed honeypot.")


class SimulationResponse(BaseModel):
    """Everything a client needs to render and explain one simulation run."""

    algorithm: SearchAlgorithm
    start_node: str
    target_node: str
    path: list[str] = Field(description="Predicted attacker path; empty when unreachable.")
    path_cost: int = Field(description="Sum of edge weights along the predicted path.")
    nodes_explored: int | None = Field(
        default=None,
        description="Nodes expanded by the search, when the algorithm reports it.",
    )
    honeypots: list[str] = Field(description="Nodes where the defender deployed honeypots.")
    honeypot_scores: list[HoneypotScore] = Field(
        default_factory=list,
        description="Full scoring table behind the placement decision.",
    )
    result: SimulationOutcome
    intercepted_at: str | None = Field(
        default=None, description="Honeypot the attacker walked into, if any."
    )
    intercepted_at_step: int | None = Field(
        default=None, description="Index along the path where interception occurred."
    )
    algorithm_comparison: list[AlgorithmComparison] = Field(
        default_factory=list,
        description="All four search algorithms run on the same scenario.",
    )
    alternative_paths: list[AlternativePath] = Field(
        default_factory=list,
        description="Up to three cheapest routes, so coverage can be checked beyond the chosen one.",
    )
    scenario_id: int | None = Field(
        default=None, description="Saved scenario the run used, or null for the built-in network."
    )
    explanation: list[str] = Field(description="Human-readable account of each AI decision.")
