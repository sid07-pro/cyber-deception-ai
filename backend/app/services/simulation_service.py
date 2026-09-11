"""
simulation_service.py
Service layer wrapping the existing simulation and AI modules.

This is a thin adapter: every search, scoring, and explanation decision is
delegated to the already-implemented modules in `simulation/` and `ai/`.
Nothing here re-implements an algorithm, and nothing here knows about HTTP.
"""

from typing import Any

from ai.attacker import ALGORITHMS, run_all_algorithms, select_attacker_path
from ai.defender import evaluate_interception, plan_defense
from ai.optimizer import DEPLOYMENT_COST
from simulation.network import (
    ATTACKER_START,
    CRITICAL,
    CRITICAL_TARGET,
    HONEYPOT_CANDIDATE,
    build_network,
    honeypot_candidates,
)
from simulation.simulator import generate_explanations

# Maps the graph's node role onto the criticality exposed by the API.
_CRITICALITY_BY_ROLE = {
    CRITICAL: "high",
    HONEYPOT_CANDIDATE: "medium",
}


class UnknownNodeError(ValueError):
    """Raised when a requested start or target node is not in the network."""

    def __init__(self, node: str, known_nodes: list[str]) -> None:
        super().__init__(f"Unknown node '{node}'. Known nodes: {', '.join(known_nodes)}.")
        self.node = node
        self.known_nodes = known_nodes


class UnsupportedAlgorithmError(ValueError):
    """Raised when a requested search strategy has no implementation."""

    def __init__(self, algorithm: str) -> None:
        supported = ", ".join(ALGORITHMS)
        super().__init__(f"Unsupported algorithm '{algorithm}'. Supported: {supported}.")
        self.algorithm = algorithm


def get_network() -> dict[str, Any]:
    """Returns the simulated topology as plain, serializable data."""
    graph = build_network()
    candidates = honeypot_candidates(graph)

    nodes = []
    for name, data in graph.nodes(data=True):
        role = data["role"]
        metadata: dict[str, Any] = {
            "degree": graph.degree(name),
            "is_attacker_start": name == ATTACKER_START,
            "is_critical_target": name == CRITICAL_TARGET,
        }
        if name in DEPLOYMENT_COST:
            metadata["deployment_cost"] = DEPLOYMENT_COST[name]

        nodes.append(
            {
                "id": name,
                "name": name,
                "type": role,
                "criticality": _CRITICALITY_BY_ROLE.get(role, "low"),
                "metadata": metadata,
            }
        )

    edges = [
        {"source": u, "target": v, "weight": data["weight"]}
        for u, v, data in graph.edges(data=True)
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "attacker_start": ATTACKER_START,
        "critical_target": CRITICAL_TARGET,
        "honeypot_candidates": candidates,
    }


def run_simulation(
    algorithm: str = "A*",
    start_node: str | None = None,
    target_node: str | None = None,
    honeypot_count: int = 2,
) -> dict[str, Any]:
    """
    Runs one attacker-vs-defender simulation and returns structured data.

    Mirrors the pipeline in `simulation.simulator.run_full_simulation`, but
    parameterized by start/target so the API can explore other scenarios.
    Raises UnknownNodeError / UnsupportedAlgorithmError on bad input.
    """
    if algorithm not in ALGORITHMS:
        raise UnsupportedAlgorithmError(algorithm)

    graph = build_network()
    known_nodes = list(graph.nodes)

    start = start_node or ATTACKER_START
    target = target_node or CRITICAL_TARGET
    for node in (start, target):
        if node not in graph:
            raise UnknownNodeError(node, known_nodes)

    # 1. Attacker agent: run every algorithm for comparison, then commit to one.
    algo_results = run_all_algorithms(graph, start, target)
    attacker_decision = select_attacker_path(graph, start, target, algorithm)

    # 2. Defender agent: score candidates against all plausible attacker routes.
    candidate_paths = [result["path"] for result in algo_results.values() if result["path"]]
    honeypot_table, selected_honeypots = plan_defense(
        graph,
        candidate_paths,
        candidates=honeypot_candidates(graph),
        target=target,
        top_n=honeypot_count,
    )

    # 3. Outcome and explanations, reusing the prototype's logic unchanged.
    intercepted, hit_node, hit_index = evaluate_interception(
        attacker_decision["path"], selected_honeypots
    )
    explanation = generate_explanations(
        attacker_decision, selected_honeypots, honeypot_table, intercepted, hit_node
    )

    if not attacker_decision["path"]:
        outcome = "no_path"
    elif intercepted:
        outcome = "intercepted"
    else:
        outcome = "target_reached"

    scores = [
        {**row, "selected": row["node"] in selected_honeypots} for row in honeypot_table
    ]
    comparison = [
        {"algorithm": name, **result} for name, result in algo_results.items()
    ]

    return {
        "algorithm": algorithm,
        "start_node": start,
        "target_node": target,
        "path": attacker_decision["path"],
        "path_cost": attacker_decision["cost"],
        "nodes_explored": attacker_decision["nodes_explored"],
        "honeypots": selected_honeypots,
        "honeypot_scores": scores,
        "result": outcome,
        "intercepted_at": hit_node,
        "intercepted_at_step": hit_index,
        "algorithm_comparison": comparison,
        "explanation": explanation,
    }
