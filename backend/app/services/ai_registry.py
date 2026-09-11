"""
ai_registry.py
Single entry point for the advanced AI techniques.

Each technique is implemented in its own module under `ai/`; this layer only
builds the scenario, dispatches, and shapes the result. No HTTP concerns here,
and nothing about the existing BFS/DFS/UCS/A* endpoints changes.
"""

from typing import Any, Callable

import networkx as nx

from ai import bayesian, genetic, hill_climbing
from ai.alpha_beta import alpha_beta
from ai.deception_game import DeceptionGame
from ai.minimax import minimax
from app.services.agents import AttackerAgent
from simulation.network import ATTACKER_START, CRITICAL_TARGET, build_network

TECHNIQUES = ("minimax", "alpha_beta", "bayesian", "hill_climbing", "genetic_algorithm")


class UnknownTechniqueError(ValueError):
    """Raised when a requested technique has no implementation."""

    def __init__(self, technique: str) -> None:
        super().__init__(
            f"Unknown technique '{technique}'. Available: {', '.join(TECHNIQUES)}."
        )
        self.technique = technique


class UnknownNodeError(ValueError):
    """Raised when a requested start or target node is not in the network."""

    def __init__(self, node: str, known_nodes: list[str]) -> None:
        super().__init__(f"Unknown node '{node}'. Known nodes: {', '.join(known_nodes)}.")
        self.node = node


def analyze(
    technique: str,
    start_node: str | None = None,
    target_node: str | None = None,
    honeypot_budget: int = 2,
    depth: int = 4,
    seed: int = 0,
    algorithm: str = "A*",
) -> dict[str, Any]:
    """Runs one advanced technique over the simulated network."""
    if technique not in TECHNIQUES:
        raise UnknownTechniqueError(technique)

    graph = build_network()
    start = start_node or ATTACKER_START
    target = target_node or CRITICAL_TARGET
    for node in (start, target):
        if node not in graph:
            raise UnknownNodeError(node, list(graph.nodes))

    handlers: dict[str, Callable[..., dict[str, Any]]] = {
        "minimax": _run_game_search,
        "alpha_beta": _run_game_search,
        "bayesian": _run_bayesian,
        "hill_climbing": _run_optimizer,
        "genetic_algorithm": _run_optimizer,
    }

    result = handlers[technique](
        technique=technique,
        graph=graph,
        start=start,
        target=target,
        honeypot_budget=honeypot_budget,
        depth=depth,
        seed=seed,
        algorithm=algorithm,
    )
    return {"technique": technique, "start_node": start, "target_node": target, **result}


def _plausible_paths(graph: nx.Graph, start: str, target: str) -> list[list[str]]:
    """Routes every search algorithm considers — the evidence both optimizers use."""
    return AttackerAgent.plausible_paths(graph, start, target)


def _run_game_search(
    *,
    technique: str,
    graph: nx.Graph,
    start: str,
    target: str,
    honeypot_budget: int,
    depth: int,
    **_: Any,
) -> dict[str, Any]:
    """Minimax / Alpha-Beta over the attacker-defender game."""
    game = DeceptionGame(graph, start, target)
    state = game.initial_state(honeypot_budget)

    search = minimax if technique == "minimax" else alpha_beta
    action, value, stats = search(game, state, depth)

    if action is None:
        recommendation = "no action available"
        honeypots: list[str] = []
    else:
        kind, node = action
        recommendation = f"{kind} {node}" if node else kind
        honeypots = []

    label = "Minimax" if technique == "minimax" else "Alpha-Beta"
    explanation = [
        f"{label} searched {depth} plies of the attacker-versus-defender game "
        f"from {start}, visiting {stats.nodes_visited} states.",
        f"The attacker's best reply is to {recommendation}, valued at {round(value, 3)} "
        "on the attacker's utility scale (positive favours the attacker).",
        "Utility combines progress toward the asset, nodes compromised, protection of "
        "the asset, deception success, and movement plus deployment cost.",
    ]
    if technique == "alpha_beta":
        explanation.append(
            f"Alpha-beta pruning skipped {stats.branches_pruned} branch(es) that could not "
            "change the result."
        )

    return {
        "recommendation": recommendation,
        "score": round(value, 4),
        "honeypots": honeypots,
        "metrics": {"depth": depth, **stats.to_dict()},
        "explanation": explanation,
    }


def _run_bayesian(
    *,
    graph: nx.Graph,
    start: str,
    target: str,
    honeypot_budget: int,
    algorithm: str,
    **_: Any,
) -> dict[str, Any]:
    """Posterior compromise risk per node, plus route-level risk."""
    attacker = AttackerAgent(algorithm)
    predicted = attacker.plan(graph, start, target)["path"]

    # Reason about the route as it stands, before any honeypot is committed.
    honeypots: list[str] = []
    per_node = [
        bayesian.node_risk(graph, node, predicted, honeypots, target) for node in sorted(graph.nodes)
    ]
    route_risk = bayesian.path_risk(
        [entry["posterior"] for entry in per_node if entry["node"] in predicted]
    )

    riskiest = max(per_node, key=lambda entry: entry["posterior"])

    return {
        "recommendation": riskiest["node"],
        "score": riskiest["posterior"],
        "probability": route_risk,
        "honeypots": [],
        "metrics": {
            "predicted_path": predicted,
            "node_risks": per_node,
            "honeypot_budget": honeypot_budget,
        },
        "explanation": [
            f"Priors come from each host's connectivity; evidence is whether the {algorithm} "
            "route crosses it, whether it is fortified, and whether it is the critical asset.",
            f"{riskiest['node']} carries the highest posterior compromise probability at "
            f"{riskiest['posterior']} (prior {riskiest['prior']}).",
            f"Treating per-node compromise as independent, the probability that at least one "
            f"host on the predicted route is compromised is {route_risk}.",
        ],
    }


def _run_optimizer(
    *,
    technique: str,
    graph: nx.Graph,
    start: str,
    target: str,
    honeypot_budget: int,
    seed: int,
    **_: Any,
) -> dict[str, Any]:
    """Hill climbing / genetic algorithm over honeypot placements."""
    paths = _plausible_paths(graph, start, target)
    module = hill_climbing if technique == "hill_climbing" else genetic
    label = "Hill climbing" if technique == "hill_climbing" else "The genetic algorithm"

    result = module.optimize_placement(
        graph, paths, start, target, honeypot_budget, seed=seed
    )
    components = result["components"]

    if result["honeypots"]:
        recommendation = ", ".join(result["honeypots"])
        summary = (
            f"{label} selected {recommendation} with fitness {result['fitness']}, "
            f"covering {components['coverage']} of the plausible attacker routes."
        )
    else:
        recommendation = "no honeypots"
        summary = f"{label} deployed no honeypots — the budget was zero or no host was eligible."

    metrics = {key: value for key, value in result.items() if key not in {"honeypots", "components"}}

    return {
        "recommendation": recommendation,
        "score": result["fitness"],
        "honeypots": result["honeypots"],
        "metrics": {**metrics, "components": components, "seed": seed},
        "explanation": [
            summary,
            "Fitness weighs attack-path coverage, proximity to the asset, host criticality, "
            "and deception potential against deployment cost.",
            f"The attacker's entry point ({start}) and the protected asset ({target}) are "
            "excluded from every candidate placement.",
        ],
    }
