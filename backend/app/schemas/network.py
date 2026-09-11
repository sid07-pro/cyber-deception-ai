"""
network.py
Pydantic schemas describing the simulated network topology exposed by the API.

These are presentation-level views of the NetworkX graph built in
`simulation.network` — the graph itself remains the single source of truth.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

Criticality = Literal["high", "medium", "low"]


class NetworkNode(BaseModel):
    """A single host in the simulated network."""

    id: str = Field(description="Stable identifier for the node.")
    name: str = Field(description="Human-readable node label.")
    type: str = Field(
        description="Role of the node in the scenario: normal, critical, or honeypot_candidate."
    )
    criticality: Criticality = Field(
        description="Derived importance: high for the critical asset, medium for honeypot candidates."
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional extras such as degree, deployment cost, and scenario flags.",
    )


class NetworkEdge(BaseModel):
    """A traversable link between two hosts."""

    source: str = Field(description="Identifier of the first node.")
    target: str = Field(description="Identifier of the second node.")
    weight: int = Field(description="Simulated difficulty of moving across this link.")


class NetworkResponse(BaseModel):
    """The full topology plus the scenario's fixed reference points."""

    nodes: list[NetworkNode]
    edges: list[NetworkEdge]
    attacker_start: str = Field(description="Default entry point used by the attacker agent.")
    critical_target: str = Field(description="Asset the defender is protecting.")
    honeypot_candidates: list[str] = Field(
        description="Nodes eligible for honeypot placement (never the critical asset)."
    )
