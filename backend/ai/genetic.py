"""
genetic.py
Genetic algorithm for honeypot placement.

An individual is a set of eligible nodes within the budget. Selection is by
tournament, crossover mixes the parents' nodes, and mutation swaps one node for
another. All randomness flows from a seeded generator, so runs are reproducible.
"""

import random
from typing import Any

import networkx as nx

from ai.fitness import FitnessWeights, eligible_nodes, evaluate


def _random_individual(rng: random.Random, pool: list[str], size: int) -> frozenset[str]:
    return frozenset(rng.sample(pool, size))


def _repair(individual: set[str], rng: random.Random, pool: list[str], size: int) -> frozenset[str]:
    """Forces an individual back to exactly `size` distinct eligible nodes."""
    genes = {node for node in individual if node in pool}
    while len(genes) > size:
        genes.remove(rng.choice(sorted(genes)))
    remaining = [node for node in pool if node not in genes]
    while len(genes) < size and remaining:
        genes.add(remaining.pop(rng.randrange(len(remaining))))
    return frozenset(genes)


def optimize_placement(
    graph: nx.Graph,
    candidate_paths: list[list[str]],
    start: str,
    target: str,
    budget: int,
    seed: int = 0,
    population_size: int = 12,
    generations: int = 15,
    mutation_rate: float = 0.2,
    weights: FitnessWeights | None = None,
) -> dict[str, Any]:
    """
    Returns the fittest placement found, its fitness breakdown, and run metrics.

    A zero budget (or a network with no eligible hosts) yields an empty placement.
    """
    pool = eligible_nodes(graph, start, target)
    budget = max(0, budget)

    if budget == 0 or not pool:
        return {
            "honeypots": [],
            "fitness": 0.0,
            "components": evaluate(graph, frozenset(), candidate_paths, target, weights),
            "generations": 0,
            "population_size": 0,
            "evaluations": 0,
        }

    rng = random.Random(seed)
    size = min(budget, len(pool))
    evaluations = 0

    def score(individual: frozenset[str]) -> float:
        nonlocal evaluations
        evaluations += 1
        return evaluate(graph, individual, candidate_paths, target, weights)["fitness"]

    population = [_random_individual(rng, pool, size) for _ in range(max(2, population_size))]
    best = max(population, key=score)
    best_score = score(best)
    history: list[float] = []

    for _ in range(max(0, generations)):
        scored = sorted(((score(ind), ind) for ind in population), key=lambda item: -item[0])
        history.append(round(scored[0][0], 4))

        if scored[0][0] > best_score:
            best_score, best = scored[0]

        # Elitism: the fittest individual always survives unchanged.
        next_generation = [scored[0][1]]

        while len(next_generation) < len(population):
            parent_a = _tournament(rng, scored)
            parent_b = _tournament(rng, scored)

            child_genes = set(rng.sample(sorted(parent_a | parent_b), min(size, len(parent_a | parent_b))))
            child = _repair(child_genes, rng, pool, size)

            if rng.random() < mutation_rate:
                outsiders = [node for node in pool if node not in child]
                if outsiders and child:
                    mutated = set(child)
                    mutated.remove(rng.choice(sorted(mutated)))
                    mutated.add(rng.choice(outsiders))
                    child = _repair(mutated, rng, pool, size)

            next_generation.append(child)

        population = next_generation

    final_score = score(best)
    if final_score > best_score:
        best_score = final_score

    components = evaluate(graph, best, candidate_paths, target, weights)
    return {
        "honeypots": sorted(best),
        "fitness": components["fitness"],
        "components": components,
        "generations": max(0, generations),
        "population_size": len(population),
        "evaluations": evaluations,
        "best_fitness_history": history,
    }


def _tournament(rng: random.Random, scored: list[tuple[float, frozenset[str]]]) -> frozenset[str]:
    """Picks the fitter of two randomly drawn individuals."""
    first = rng.choice(scored)
    second = rng.choice(scored)
    return first[1] if first[0] >= second[0] else second[1]
