"""
fitness.py
Transparent fitness function for honeypot placements, shared by Hill Climbing
and the Genetic Algorithm so both optimize exactly the same objective.

Fitness(placement) =
      w_coverage   * attack-path coverage
    + w_proximity  * mean closeness to the protected asset
    + w_criticality* mean criticality of the fortified hosts
    + w_deception  * mean deception potential (connectivity)
    - w_cost       * total deployment cost

Every term is normalized to roughly [0, 1] before weighting, so the weights
read directly as relative importance.
"""

from dataclasses import dataclass

import networkx as nx

from ai.optimizer import DEPLOYMENT_COST
from simulation.network import CRITICAL, HONEYPOT_CANDIDATE, NODE_ROLES

CRITICALITY = {CRITICAL: 1.0, HONEYPOT_CANDIDATE: 0.6}


@dataclass(frozen=True)
class FitnessWeights:
    """Relative importance of each placement factor."""

    coverage: float = 4.0
    proximity: float = 2.0
    criticality: float = 1.0
    deception: float = 1.5
    cost: float = 1.0


def eligible_nodes(graph: nx.Graph, start: str, target: str) -> list[str]:
    """Nodes a honeypot may occupy — never the attacker's entry point or the asset."""
    return sorted(node for node in graph.nodes if node not in {start, target})


def evaluate(
    graph: nx.Graph,
    placement: frozenset[str] | set[str],
    candidate_paths: list[list[str]],
    target: str,
    weights: FitnessWeights | None = None,
) -> dict[str, float]:
    """Scores one placement and returns the score with its component parts."""
    weights = weights or FitnessWeights()
    nodes = sorted(placement)

    if not nodes:
        return {
            "fitness": 0.0,
            "coverage": 0.0,
            "proximity": 0.0,
            "criticality": 0.0,
            "deception": 0.0,
            "cost": 0.0,
        }

    # Coverage: share of plausible attacker routes this placement intercepts.
    if candidate_paths:
        intercepted = sum(1 for path in candidate_paths if any(node in path for node in nodes))
        coverage = intercepted / len(candidate_paths)
    else:
        coverage = 0.0

    distances = nx.single_source_shortest_path_length(graph, target)
    proximity = sum(1 / (1 + distances.get(node, len(graph))) for node in nodes) / len(nodes)

    criticality = sum(CRITICALITY.get(NODE_ROLES.get(node, ""), 0.2) for node in nodes) / len(nodes)

    max_degree = max((degree for _, degree in graph.degree()), default=1) or 1
    deception = sum(graph.degree(node) / max_degree for node in nodes) / len(nodes)

    total_cost = sum(DEPLOYMENT_COST.get(node, 1) for node in nodes)
    max_cost = max(DEPLOYMENT_COST.values(), default=1) * len(nodes)
    normalized_cost = total_cost / max_cost if max_cost else 0.0

    fitness = (
        weights.coverage * coverage
        + weights.proximity * proximity
        + weights.criticality * criticality
        + weights.deception * deception
        - weights.cost * normalized_cost
    )

    return {
        "fitness": round(fitness, 4),
        "coverage": round(coverage, 4),
        "proximity": round(proximity, 4),
        "criticality": round(criticality, 4),
        "deception": round(deception, 4),
        "cost": total_cost,
    }
