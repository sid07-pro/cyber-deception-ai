"""
planning_service.py
Adapter between the planning API and `ai.planning`.

Builds the domain from the existing network model, dispatches to the forward
or backward planner, and shapes the result. No HTTP concerns here.
"""

from typing import Any

from ai.planning import (
    GOAL_TYPES,
    DefensivePlanningDomain,
    backward_plan,
    build_goal,
    forward_plan,
)
from simulation.network import ATTACKER_START, CRITICAL_TARGET, build_network

METHODS = ("forward", "backward")


class UnknownMethodError(ValueError):
    """Raised when a planning method has no implementation."""

    def __init__(self, method: str) -> None:
        super().__init__(f"Unknown planning method '{method}'. Available: {', '.join(METHODS)}.")
        self.method = method


class UnknownGoalError(ValueError):
    """Raised when a goal type is not part of the domain."""

    def __init__(self, goal_type: str) -> None:
        super().__init__(f"Unknown goal type '{goal_type}'. Available: {', '.join(GOAL_TYPES)}.")
        self.goal_type = goal_type


class UnknownNodeError(ValueError):
    """Raised when a requested start or target node is not in the network."""

    def __init__(self, node: str, known_nodes: list[str]) -> None:
        super().__init__(f"Unknown node '{node}'. Known nodes: {', '.join(known_nodes)}.")
        self.node = node


def plan(
    method: str = "forward",
    start_node: str | None = None,
    target_node: str | None = None,
    honeypot_budget: int = 2,
    max_depth: int = 4,
    goal_type: str = "protect_target",
) -> dict[str, Any]:
    """Runs one planning request and returns structured data."""
    if method not in METHODS:
        raise UnknownMethodError(method)
    if goal_type not in GOAL_TYPES:
        raise UnknownGoalError(goal_type)

    graph = build_network()
    start = start_node or ATTACKER_START
    target = target_node or CRITICAL_TARGET
    for node in (start, target):
        if node not in graph:
            raise UnknownNodeError(node, list(graph.nodes))

    domain = DefensivePlanningDomain(graph, start, target, honeypot_budget)
    goal, goal_description = build_goal(domain, goal_type)

    planner = forward_plan if method == "forward" else backward_plan
    result = planner(domain, goal, max_depth=max_depth)
    result.goal_description = goal_description

    payload = result.to_dict()
    payload.update(
        {
            "start_node": start,
            "target_node": target,
            "goal_type": goal_type,
            "honeypot_budget": honeypot_budget,
            "max_depth": max_depth,
            "explanation": _explain(result, method, goal_description, max_depth),
        }
    )
    return payload


def _explain(result, method: str, goal_description: str, max_depth: int) -> list[str]:
    label = "Forward state-space search" if method == "forward" else "Backward regression"
    direction = (
        "progressing from the current state toward the goal"
        if method == "forward"
        else "regressing from the goal toward the current state"
    )

    lines = [
        f"{label} was used, {direction}, with the goal: {goal_description}.",
        f"{result.explored_states} state(s) were explored within a depth limit of {max_depth}.",
    ]

    if result.success:
        steps = " → ".join(str(action) for action in result.actions) or "no action needed"
        lines.append(
            f"A plan of {len(result.actions)} action(s) was found at total cost "
            f"{result.cost}: {steps}."
        )
    else:
        lines.append(f"No plan was found — {result.reason}.")

    return lines
