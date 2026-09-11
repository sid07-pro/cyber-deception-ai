"""
deception_engine.py
Deterministic attacker-vs-defender simulation, advanced one step at a time.

Flow: initialize -> attacker plans a path -> defender places honeypots ->
the attacker walks the path hop by hop until it is deceived or reaches the
asset. Every algorithm and scoring decision is delegated to the existing
`ai/` and `simulation/` modules; nothing is reimplemented here.
"""

from typing import Any

from app.services.agents import AttackerAgent, DefenderAgent
from app.services.session_store import session_store
from app.services.simulation_state import SimulationState
from simulation.network import ATTACKER_START, CRITICAL_TARGET, build_network


class UnknownNodeError(ValueError):
    """Raised when a requested start or target node is not in the network."""

    def __init__(self, node: str, known_nodes: list[str]) -> None:
        super().__init__(f"Unknown node '{node}'. Known nodes: {', '.join(known_nodes)}.")
        self.node = node


def start_simulation(
    algorithm: str = "A*",
    start_node: str | None = None,
    target_node: str | None = None,
    honeypot_budget: int = 2,
) -> SimulationState:
    """Creates a session, plans the attack, places honeypots, and returns step 0."""
    graph = build_network()
    start = start_node or ATTACKER_START
    target = target_node or CRITICAL_TARGET
    for node in (start, target):
        if node not in graph:
            raise UnknownNodeError(node, list(graph.nodes))

    state = SimulationState(
        session_id=session_store.new_id(),
        algorithm=algorithm,
        start_node=start,
        target_node=target,
        honeypot_budget=honeypot_budget,
    )
    _initialize(state)
    return session_store.save(state)


def step_simulation(session_id: str) -> SimulationState:
    """Advances the attacker by one hop. A completed simulation is left untouched."""
    state = session_store.get(session_id)
    if state.is_complete:
        return state

    state.time_step += 1
    state.path_index += 1
    node = state.predicted_path[state.path_index]
    state.attacker_position = node
    state.visited_nodes.append(node)
    state.record("move", f"The attacker moved to {node}.", node)

    if node in state.honeypots:
        state.status = "completed"
        state.outcome = "intercepted"
        state.record(
            "intercepted",
            f"{node} is a honeypot. The attacker was deceived before reaching "
            f"{state.target_node}.",
            node,
        )
        return state

    state.compromised_nodes.append(node)
    state.record("compromise", f"{node} was compromised by the attacker.", node)

    if node == state.target_node:
        state.status = "completed"
        state.outcome = "target_reached"
        state.record(
            "target_reached",
            f"The attacker reached the protected asset {node}. Deception failed.",
            node,
        )

    return state


def reset_simulation(session_id: str) -> SimulationState:
    """Rewinds a session to step 0, keeping its configuration and session id."""
    state = session_store.get(session_id)
    fresh = SimulationState(
        session_id=state.session_id,
        algorithm=state.algorithm,
        start_node=state.start_node,
        target_node=state.target_node,
        honeypot_budget=state.honeypot_budget,
    )
    _initialize(fresh)
    return session_store.save(fresh)


def get_simulation(session_id: str) -> SimulationState:
    """Returns a live session without changing it."""
    return session_store.get(session_id)


def _initialize(state: SimulationState) -> None:
    """Runs the planning phase and seeds the attacker at its entry point."""
    graph = build_network()
    attacker = AttackerAgent(state.algorithm)
    defender = DefenderAgent(state.honeypot_budget)

    state.attacker_position = state.start_node
    state.visited_nodes = [state.start_node]
    state.compromised_nodes = [state.start_node]

    if state.start_node == state.target_node:
        state.status = "completed"
        state.outcome = "invalid"
        state.record(
            "invalid",
            "The entry point and the protected asset are the same node — nothing to simulate.",
            state.start_node,
        )
        state.explanation = [
            "No simulation was run: the attacker would already be at its goal."
        ]
        return

    decision = attacker.plan(graph, state.start_node, state.target_node)
    state.predicted_path = decision["path"]
    state.path_cost = decision["cost"]
    state.nodes_explored = decision["nodes_explored"]

    candidate_paths = attacker.plausible_paths(graph, state.start_node, state.target_node)
    table, selected, defence_explanation = defender.place(
        graph, candidate_paths, state.start_node, state.target_node
    )
    state.honeypot_scores = [
        {**row, "selected": row["node"] in selected} for row in table
    ]
    state.honeypots = selected
    state.protection = _protection_summary(state.predicted_path, selected)

    if not state.predicted_path:
        state.status = "completed"
        state.outcome = "failed"
        state.record(
            "failed",
            f"No route exists from {state.start_node} to {state.target_node}.",
            state.start_node,
        )
        state.explanation = [
            f"The attacker agent ({state.algorithm}) found no path to {state.target_node}."
        ] + defence_explanation
        return

    state.status = "running"
    state.record(
        "plan",
        f"The attacker agent planned {' → '.join(state.predicted_path)} using "
        f"{state.algorithm} (cost {state.path_cost}, {state.nodes_explored} nodes explored).",
        state.start_node,
    )
    state.record(
        "deploy",
        (
            f"The defender deployed honeypots at {', '.join(selected)}."
            if selected
            else "The defender deployed no honeypots."
        ),
        None,
    )
    state.explanation = [
        f"The attacker agent used {state.algorithm} and committed to "
        f"{' → '.join(state.predicted_path)} at a total cost of {state.path_cost}.",
        *defence_explanation,
        (
            f"The predicted route crosses {state.protection['covered_nodes']} honeypot(s), "
            "so deception is expected to succeed."
            if state.protection["covered_nodes"]
            else "The predicted route crosses no honeypot, so the asset is expected to fall."
        ),
    ]


def _protection_summary(path: list[str], honeypots: list[str]) -> dict[str, Any]:
    """How well the deployed honeypots cover the predicted route."""
    covered = [node for node in path if node in honeypots]
    coverage = round(len(covered) / len(path), 3) if path else 0.0

    if not path:
        risk = "unknown"
    elif covered:
        risk = "low"
    elif honeypots:
        risk = "medium"
    else:
        risk = "high"

    return {
        "covered_nodes": len(covered),
        "path_coverage": coverage,
        "risk_level": risk,
    }
