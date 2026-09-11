"""
hill_climbing.py
Steepest-ascent hill climbing with random restarts for honeypot placement.

A candidate solution is a set of eligible nodes no larger than the budget.
Neighbours are produced by swapping, adding, or dropping a single node, so the
walk stays inside the feasible region at every step.
"""

import random
from typing import Any

import networkx as nx

from ai.fitness import FitnessWeights, eligible_nodes, evaluate


def _neighbours(candidate: frozenset[str], pool: list[str], budget: int) -> list[frozenset[str]]:
    """Placements one edit away: swap a node, drop one, or add one."""
    moves: list[frozenset[str]] = []

    for inside in candidate:
        moves.append(candidate - {inside})
        for outside in pool:
            if outside not in candidate:
                moves.append((candidate - {inside}) | {outside})

    if len(candidate) < budget:
        for outside in pool:
            if outside not in candidate:
                moves.append(candidate | {outside})

    # Deterministic order so a seeded run is reproducible.
    return sorted({move for move in moves if len(move) <= budget}, key=sorted)


def optimize_placement(
    graph: nx.Graph,
    candidate_paths: list[list[str]],
    start: str,
    target: str,
    budget: int,
    seed: int = 0,
    restarts: int = 4,
    weights: FitnessWeights | None = None,
) -> dict[str, Any]:
    """
    Returns the best placement found, its fitness breakdown, and search metrics.

    A zero budget (or a network with no eligible hosts) yields an empty placement
    rather than an error.
    """
    pool = eligible_nodes(graph, start, target)
    budget = max(0, budget)

    if budget == 0 or not pool:
        return {
            "honeypots": [],
            "fitness": 0.0,
            "components": evaluate(graph, frozenset(), candidate_paths, target, weights),
            "iterations": 0,
            "restarts": 0,
            "evaluations": 0,
        }

    rng = random.Random(seed)
    size = min(budget, len(pool))

    best: frozenset[str] = frozenset()
    best_score = float("-inf")
    iterations = 0
    evaluations = 0

    for restart in range(max(1, restarts)):
        # First restart starts from the highest-degree hosts, the rest are random.
        if restart == 0:
            seeded = sorted(pool, key=lambda node: (-graph.degree(node), node))[:size]
            current = frozenset(seeded)
        else:
            current = frozenset(rng.sample(pool, size))

        current_score = evaluate(graph, current, candidate_paths, target, weights)["fitness"]
        evaluations += 1

        while True:
            iterations += 1
            improved = False

            for neighbour in _neighbours(current, pool, budget):
                score = evaluate(graph, neighbour, candidate_paths, target, weights)["fitness"]
                evaluations += 1
                if score > current_score:
                    current, current_score = neighbour, score
                    improved = True

            if not improved:
                break

        if current_score > best_score:
            best, best_score = current, current_score

    components = evaluate(graph, best, candidate_paths, target, weights)
    return {
        "honeypots": sorted(best),
        "fitness": components["fitness"],
        "components": components,
        "iterations": iterations,
        "restarts": max(1, restarts),
        "evaluations": evaluations,
    }
