"""
simulation_state.py
Deterministic state model for a stepped attacker-vs-defender simulation.

Plain dataclasses: the engine mutates them, the API layer serializes them.
"""

from dataclasses import dataclass, field
from typing import Any, Literal

SimulationStatus = Literal["ready", "running", "completed"]
SimulationOutcome = Literal["intercepted", "target_reached", "failed", "invalid"]


@dataclass
class SimulationEvent:
    """One thing that happened at a given time step."""

    step: int
    kind: str
    node: str | None
    message: str

    def to_dict(self) -> dict[str, Any]:
        return {"step": self.step, "kind": self.kind, "node": self.node, "message": self.message}


@dataclass
class SimulationState:
    """Everything needed to render and advance one simulation session."""

    session_id: str
    algorithm: str
    start_node: str
    target_node: str
    honeypot_budget: int

    predicted_path: list[str] = field(default_factory=list)
    path_cost: int = 0
    nodes_explored: int = 0

    honeypots: list[str] = field(default_factory=list)
    honeypot_scores: list[dict[str, Any]] = field(default_factory=list)

    attacker_position: str = ""
    path_index: int = 0
    visited_nodes: list[str] = field(default_factory=list)
    compromised_nodes: list[str] = field(default_factory=list)

    time_step: int = 0
    status: SimulationStatus = "ready"
    outcome: SimulationOutcome | None = None
    events: list[SimulationEvent] = field(default_factory=list)
    explanation: list[str] = field(default_factory=list)
    protection: dict[str, Any] = field(default_factory=dict)

    @property
    def is_complete(self) -> bool:
        return self.status == "completed"

    @property
    def current_event(self) -> SimulationEvent | None:
        return self.events[-1] if self.events else None

    def record(self, kind: str, message: str, node: str | None = None) -> None:
        """Appends an event stamped with the current time step."""
        self.events.append(
            SimulationEvent(step=self.time_step, kind=kind, node=node, message=message)
        )

    def to_dict(self) -> dict[str, Any]:
        current = self.current_event
        return {
            "session_id": self.session_id,
            "algorithm": self.algorithm,
            "start_node": self.start_node,
            "target_node": self.target_node,
            "honeypot_budget": self.honeypot_budget,
            "predicted_path": self.predicted_path,
            "path_cost": self.path_cost,
            "nodes_explored": self.nodes_explored,
            "honeypots": self.honeypots,
            "honeypot_scores": self.honeypot_scores,
            "attacker_position": self.attacker_position,
            "path_index": self.path_index,
            "visited_nodes": self.visited_nodes,
            "compromised_nodes": self.compromised_nodes,
            "time_step": self.time_step,
            "status": self.status,
            "outcome": self.outcome,
            "is_complete": self.is_complete,
            "current_event": current.to_dict() if current else None,
            "events": [event.to_dict() for event in self.events],
            "explanation": self.explanation,
            "protection": self.protection,
        }
