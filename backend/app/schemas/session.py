"""
session.py
Request/response schemas for the stepped simulation sessions.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.simulation import HoneypotScore, SearchAlgorithm

SimulationStatus = Literal["ready", "running", "completed"]
SimulationOutcome = Literal["intercepted", "target_reached", "failed", "invalid"]


class StartSimulationRequest(BaseModel):
    """Configuration for a new simulation session."""

    algorithm: SearchAlgorithm = Field(
        default=SearchAlgorithm.ASTAR, description="Search strategy the attacker agent uses."
    )
    start_node: str | None = Field(default=None, description="Attacker entry point.")
    target_node: str | None = Field(default=None, description="Asset the defender protects.")
    honeypot_budget: int = Field(
        default=2, ge=0, le=5, description="How many honeypots the defender may deploy."
    )


class SessionRequest(BaseModel):
    """Identifies an existing session."""

    session_id: str = Field(description="Identifier returned by /simulation/start.")


class SimulationEvent(BaseModel):
    """One thing that happened at a given time step."""

    step: int
    kind: str
    node: str | None = None
    message: str


class ProtectionSummary(BaseModel):
    """How well the deployed honeypots cover the predicted route."""

    covered_nodes: int
    path_coverage: float
    risk_level: str


class SimulationStateResponse(BaseModel):
    """Full state of one simulation session."""

    session_id: str
    algorithm: str
    start_node: str
    target_node: str
    honeypot_budget: int

    predicted_path: list[str]
    path_cost: int
    nodes_explored: int

    honeypots: list[str]
    honeypot_scores: list[HoneypotScore] = Field(default_factory=list)

    attacker_position: str
    path_index: int
    visited_nodes: list[str]
    compromised_nodes: list[str]

    time_step: int
    status: SimulationStatus
    outcome: SimulationOutcome | None = None
    is_complete: bool

    current_event: SimulationEvent | None = None
    events: list[SimulationEvent]
    explanation: list[str]
    protection: dict[str, Any] = Field(default_factory=dict)
