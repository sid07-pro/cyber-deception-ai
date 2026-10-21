"""
simulation_service.py
Service layer wrapping the existing simulation and AI modules.

This is a thin adapter: every search, scoring, and explanation decision is
delegated to the already-implemented modules in `simulation/` and `ai/`.
Nothing here re-implements an algorithm, and nothing here knows about HTTP.
"""

from itertools import islice
from typing import Any

import networkx as nx

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


# How many cheapest loop-free routes to report alongside the chosen one.
MAX_ALTERNATIVE_PATHS = 3


def graph_from_scenario(scenario: dict[str, Any]) -> dict[str, Any]:
    """
    Rebuilds a NetworkX graph from a saved scenario (shaped like
    `persistence_service.scenario_to_dict`), with the same `role` and `weight`
    attributes the built-in network uses, so every algorithm runs unchanged.
    """
    graph = nx.Graph()
    costs: dict[str, int] = {}
    for node in scenario["nodes"]:
        graph.add_node(node["id"], role=node["type"])
        cost = (node.get("metadata") or {}).get("deployment_cost")
        if isinstance(cost, (int, float)) and cost > 0:
            costs[node["id"]] = cost
    for edge in scenario["edges"]:
        graph.add_edge(edge["source"], edge["target"], weight=edge["weight"])

    return {
        "graph": graph,
        "attacker_start": scenario["attacker_start"],
        "critical_target": scenario["critical_target"],
        "candidates": list(scenario["honeypot_candidates"]),
        "deployment_costs": costs,
    }


def alternative_paths(
    graph: nx.Graph, start: str, target: str, honeypots: list[str], limit: int = MAX_ALTERNATIVE_PATHS
) -> list[dict[str, Any]]:
    """
    The `limit` cheapest loop-free routes (Yen's algorithm via NetworkX), each
    with its cost, hop count, and which deployed honeypots it passes through.

    This is deterministic graph enumeration, not a learned prediction: it shows
    the routes an attacker minimising path cost would consider next.
    """
    try:
        routes = list(islice(nx.shortest_simple_paths(graph, start, target, weight="weight"), limit))
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return []

    result = []
    for rank, route in enumerate(routes, start=1):
        cost = sum(graph[a][b]["weight"] for a, b in zip(route, route[1:]))
        covered = [node for node in route if node in honeypots]
        result.append(
            {
                "rank": rank,
                "path": route,
                "cost": cost,
                "hops": len(route) - 1,
                "honeypots_on_path": covered,
                "intercepted": bool(covered),
            }
        )
    return result


def run_simulation(
    algorithm: str = "A*",
    start_node: str | None = None,
    target_node: str | None = None,
    honeypot_count: int = 2,
    scenario: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Runs one attacker-vs-defender simulation and returns structured data.

    Mirrors the pipeline in `simulation.simulator.run_full_simulation`, but
    parameterized by start/target so the API can explore other scenarios.
    When `scenario` is given (a saved topology), it replaces the built-in network.
    Raises UnknownNodeError / UnsupportedAlgorithmError on bad input.
    """
    if algorithm not in ALGORITHMS:
        raise UnsupportedAlgorithmError(algorithm)

    if scenario is None:
        graph = build_network()
        default_start, default_target = ATTACKER_START, CRITICAL_TARGET
        candidates = honeypot_candidates(graph)
        deployment_costs = None
    else:
        built = graph_from_scenario(scenario)
        graph = built["graph"]
        default_start, default_target = built["attacker_start"], built["critical_target"]
        candidates = built["candidates"]
        deployment_costs = built["deployment_costs"]
    known_nodes = list(graph.nodes)

    start = start_node or default_start
    target = target_node or default_target
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
        # The defender never disguises the asset it protects or the entry point.
        candidates=[node for node in candidates if node not in (start, target)],
        target=target,
        top_n=honeypot_count,
        deployment_costs=deployment_costs,
    )

    # 3. Outcome and explanations, reusing the prototype's logic unchanged.
    intercepted, hit_node, hit_index = evaluate_interception(
        attacker_decision["path"], selected_honeypots
    )
    explanation = generate_explanations(
        attacker_decision, selected_honeypots, honeypot_table, intercepted, hit_node, target=target
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
        "alternative_paths": alternative_paths(graph, start, target, selected_honeypots),
        "scenario_id": scenario["id"] if scenario else None,
        "explanation": explanation,
    }
