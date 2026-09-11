"""
experiment_service.py
Runs controlled, repeated simulations to compare honeypot strategies.

Every strategy delegates to an existing implementation — the greedy optimizer,
hill climbing, or the genetic algorithm — and attacker paths come from the
existing search agents. Nothing is reimplemented here; this module only repeats
runs, varies seeds, and aggregates metrics.
"""

import random
import time
from typing import Any, Callable
from uuid import uuid4

import networkx as nx

from ai import genetic, hill_climbing
from ai.attacker import ALGORITHMS
from ai.defender import evaluate_interception
from ai.fitness import eligible_nodes, evaluate
from app.services.agents import AttackerAgent, DefenderAgent
from simulation.network import ATTACKER_START, CRITICAL_TARGET, build_network

STRATEGIES = ("none", "random", "greedy", "hill_climbing", "genetic_algorithm")

MAX_RUNS = 100
MAX_RUN_SUMMARIES = 20


class InvalidExperimentError(ValueError):
    """Raised when an experiment configuration cannot be run."""


class ExperimentNotFoundError(KeyError):
    """Raised when an experiment id is not in the store."""

    def __init__(self, experiment_id: str) -> None:
        super().__init__(f"No experiment with id '{experiment_id}'.")
        self.experiment_id = experiment_id


class ExperimentStore:
    """In-memory registry of completed experiments. Nothing is persisted."""

    def __init__(self) -> None:
        self._experiments: dict[str, dict[str, Any]] = {}

    def save(self, experiment: dict[str, Any]) -> dict[str, Any]:
        self._experiments[experiment["experiment_id"]] = experiment
        return experiment

    def get(self, experiment_id: str) -> dict[str, Any]:
        try:
            return self._experiments[experiment_id]
        except KeyError as exc:
            raise ExperimentNotFoundError(experiment_id) from exc

    def list_ids(self) -> list[str]:
        return list(self._experiments)

    def clear(self) -> None:
        self._experiments.clear()


experiment_store = ExperimentStore()


# ---- Placement strategies ----

def _place(
    strategy: str,
    graph: nx.Graph,
    candidate_paths: list[list[str]],
    start: str,
    target: str,
    budget: int,
    seed: int,
) -> tuple[list[str], float]:
    """Returns (honeypots, fitness) for one strategy, delegating to existing code."""
    if strategy == "none" or budget <= 0:
        return [], 0.0

    if strategy == "random":
        pool = eligible_nodes(graph, start, target)
        rng = random.Random(seed)
        chosen = sorted(rng.sample(pool, min(budget, len(pool))))
        return chosen, evaluate(graph, frozenset(chosen), candidate_paths, target)["fitness"]

    if strategy == "greedy":
        _, selected, _ = DefenderAgent(budget).place(graph, candidate_paths, start, target)
        return selected, evaluate(graph, frozenset(selected), candidate_paths, target)["fitness"]

    module = hill_climbing if strategy == "hill_climbing" else genetic
    result = module.optimize_placement(
        graph, candidate_paths, start, target, budget, seed=seed
    )
    return result["honeypots"], result["fitness"]


# ---- Execution ----

def _validate(
    algorithm: str, strategy: str, runs: int, honeypot_budget: int, graph: nx.Graph,
    start: str, target: str,
) -> None:
    if algorithm not in ALGORITHMS:
        raise InvalidExperimentError(
            f"Unknown algorithm '{algorithm}'. Available: {', '.join(ALGORITHMS)}."
        )
    if strategy not in STRATEGIES:
        raise InvalidExperimentError(
            f"Unknown strategy '{strategy}'. Available: {', '.join(STRATEGIES)}."
        )
    if not 1 <= runs <= MAX_RUNS:
        raise InvalidExperimentError(f"runs must be between 1 and {MAX_RUNS}; got {runs}.")
    if honeypot_budget < 0:
        raise InvalidExperimentError("honeypot_budget cannot be negative.")
    for node in (start, target):
        if node not in graph:
            raise InvalidExperimentError(
                f"Unknown node '{node}'. Known nodes: {', '.join(graph.nodes)}."
            )


def _run_strategy(
    graph: nx.Graph,
    algorithm: str,
    strategy: str,
    start: str,
    target: str,
    honeypot_budget: int,
    runs: int,
    seed: int,
) -> list[dict[str, Any]]:
    """Executes `runs` bounded simulations and returns one summary per run."""
    attacker = AttackerAgent(algorithm)
    decision = attacker.plan(graph, start, target)
    candidate_paths = attacker.plausible_paths(graph, start, target)
    path = decision["path"]

    summaries: list[dict[str, Any]] = []
    for index in range(runs):
        started = time.perf_counter()
        run_seed = seed + index

        honeypots, fitness = _place(
            strategy, graph, candidate_paths, start, target, honeypot_budget, run_seed
        )
        intercepted, hit_node, hit_index = evaluate_interception(path, honeypots)

        if not path:
            outcome, steps = "failed", 0
        elif intercepted:
            outcome, steps = "intercepted", hit_index
        else:
            outcome, steps = "target_reached", len(path) - 1

        summaries.append(
            {
                "run": index + 1,
                "seed": run_seed,
                "outcome": outcome,
                "path_cost": decision["cost"],
                "nodes_explored": decision["nodes_explored"],
                "steps": steps,
                "honeypots": honeypots,
                "honeypot_count": len(honeypots),
                "intercepted_at": hit_node,
                "fitness": round(fitness, 4),
                "execution_ms": round((time.perf_counter() - started) * 1000, 3),
            }
        )

    return summaries


def _aggregate(summaries: list[dict[str, Any]]) -> dict[str, Any]:
    """Turns per-run summaries into the experiment's aggregate metrics."""
    total = len(summaries)
    if total == 0:
        return {"total_runs": 0}

    intercepted = sum(1 for run in summaries if run["outcome"] == "intercepted")
    succeeded = sum(1 for run in summaries if run["outcome"] == "target_reached")

    def mean(key: str) -> float:
        return round(sum(run[key] for run in summaries) / total, 4)

    return {
        "total_runs": total,
        "successful_attacks": succeeded,
        "intercepted_attacks": intercepted,
        "deception_success_rate": round(intercepted / total, 4),
        "attack_success_rate": round(succeeded / total, 4),
        "average_path_cost": mean("path_cost"),
        "average_nodes_explored": mean("nodes_explored"),
        "average_steps": mean("steps"),
        "average_execution_ms": mean("execution_ms"),
        "average_honeypot_count": mean("honeypot_count"),
        "average_fitness": mean("fitness"),
    }


def run_experiment(
    algorithm: str = "A*",
    strategy: str = "greedy",
    honeypot_budget: int = 2,
    runs: int = 10,
    seed: int = 0,
    start_node: str | None = None,
    target_node: str | None = None,
    compare_strategies: bool = True,
) -> dict[str, Any]:
    """Runs one experiment, stores it, and returns its full report."""
    graph = build_network()
    start = start_node or ATTACKER_START
    target = target_node or CRITICAL_TARGET
    _validate(algorithm, strategy, runs, honeypot_budget, graph, start, target)

    summaries = _run_strategy(
        graph, algorithm, strategy, start, target, honeypot_budget, runs, seed
    )
    metrics = _aggregate(summaries)

    comparison: list[dict[str, Any]] = []
    if compare_strategies:
        for other in STRATEGIES:
            other_metrics = _aggregate(
                _run_strategy(
                    graph, algorithm, other, start, target, honeypot_budget, runs, seed
                )
            )
            comparison.append({"strategy": other, **other_metrics})

    configuration = {
        "algorithm": algorithm,
        "strategy": strategy,
        "honeypot_budget": honeypot_budget,
        "runs": runs,
        "seed": seed,
        "start_node": start,
        "target_node": target,
        "compare_strategies": compare_strategies,
    }

    experiment = {
        "experiment_id": uuid4().hex,
        "configuration": configuration,
        "metrics": metrics,
        "strategy_comparison": comparison,
        "runs": summaries[:MAX_RUN_SUMMARIES],
        "truncated_runs": max(0, len(summaries) - MAX_RUN_SUMMARIES),
        "explanation": _explain(configuration, metrics, comparison),
    }
    return experiment_store.save(experiment)


def get_experiment(experiment_id: str) -> dict[str, Any]:
    """Returns a stored experiment report."""
    return experiment_store.get(experiment_id)


def _explain(
    configuration: dict[str, Any],
    metrics: dict[str, Any],
    comparison: list[dict[str, Any]],
) -> list[str]:
    lines = [
        f"{metrics['total_runs']} run(s) of the {configuration['algorithm']} attacker against "
        f"the '{configuration['strategy']}' honeypot strategy with a budget of "
        f"{configuration['honeypot_budget']}.",
        f"Deception succeeded in {metrics['intercepted_attacks']} run(s) "
        f"({metrics['deception_success_rate']:.0%}); the attacker reached "
        f"{configuration['target_node']} in {metrics['successful_attacks']} "
        f"({metrics['attack_success_rate']:.0%}).",
        f"Average path cost {metrics['average_path_cost']}, average "
        f"{metrics['average_steps']} step(s) before the run ended.",
    ]

    if comparison:
        best = max(comparison, key=lambda row: row["deception_success_rate"])
        lines.append(
            f"Across strategies, '{best['strategy']}' intercepted the most attacks "
            f"({best['deception_success_rate']:.0%} of runs)."
        )

    return lines


# Exposed for the API layer's error mapping.
ERRORS: dict[str, Callable[..., Exception]] = {
    "invalid": InvalidExperimentError,
    "not_found": ExperimentNotFoundError,
}
