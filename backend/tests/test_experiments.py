"""
test_experiments.py
Covers the experiment engine, its metrics, and the experiment endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import experiment_service
from app.services.experiment_service import (
    MAX_RUN_SUMMARIES,
    STRATEGIES,
    InvalidExperimentError,
    experiment_store,
)
from simulation.network import ATTACKER_START, CRITICAL_TARGET

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_experiments():
    experiment_store.clear()
    yield
    experiment_store.clear()


# ---- Engine ----


@pytest.mark.parametrize("strategy", STRATEGIES)
def test_every_strategy_runs_and_reports_metrics(strategy):
    experiment = experiment_service.run_experiment(
        strategy=strategy, runs=5, seed=1, compare_strategies=False
    )
    metrics = experiment["metrics"]

    assert metrics["total_runs"] == 5
    assert metrics["successful_attacks"] + metrics["intercepted_attacks"] == 5
    assert metrics["deception_success_rate"] + metrics["attack_success_rate"] == 1.0
    assert metrics["average_path_cost"] > 0
    assert metrics["average_nodes_explored"] > 0
    assert metrics["average_execution_ms"] >= 0

    for run in experiment["runs"]:
        assert ATTACKER_START not in run["honeypots"]
        assert CRITICAL_TARGET not in run["honeypots"]


def test_no_deception_always_lets_the_attacker_through():
    experiment = experiment_service.run_experiment(
        strategy="none", runs=4, compare_strategies=False
    )
    metrics = experiment["metrics"]

    assert metrics["attack_success_rate"] == 1.0
    assert metrics["deception_success_rate"] == 0.0
    assert metrics["average_honeypot_count"] == 0.0


def test_zero_budget_deploys_no_honeypots():
    experiment = experiment_service.run_experiment(
        strategy="genetic_algorithm", honeypot_budget=0, runs=3, compare_strategies=False
    )

    assert experiment["metrics"]["average_honeypot_count"] == 0.0
    assert all(run["honeypots"] == [] for run in experiment["runs"])


def test_a_seeded_experiment_is_deterministic():
    first = experiment_service.run_experiment(
        strategy="random", runs=6, seed=42, compare_strategies=False
    )
    second = experiment_service.run_experiment(
        strategy="random", runs=6, seed=42, compare_strategies=False
    )

    # Wall-clock timing is the one metric that cannot be deterministic.
    def without_timing(metrics: dict) -> dict:
        return {k: v for k, v in metrics.items() if k != "average_execution_ms"}

    assert without_timing(first["metrics"]) == without_timing(second["metrics"])
    assert [run["honeypots"] for run in first["runs"]] == [
        run["honeypots"] for run in second["runs"]
    ]
    assert [run["outcome"] for run in first["runs"]] == [
        run["outcome"] for run in second["runs"]
    ]
    assert first["experiment_id"] != second["experiment_id"]


def test_different_seeds_change_random_placements():
    first = experiment_service.run_experiment(
        strategy="random", honeypot_budget=1, runs=6, seed=1, compare_strategies=False
    )
    second = experiment_service.run_experiment(
        strategy="random", honeypot_budget=1, runs=6, seed=500, compare_strategies=False
    )

    assert [run["honeypots"] for run in first["runs"]] != [
        run["honeypots"] for run in second["runs"]
    ]


def test_strategy_comparison_covers_every_strategy():
    experiment = experiment_service.run_experiment(runs=3, compare_strategies=True)
    rows = experiment["strategy_comparison"]

    assert [row["strategy"] for row in rows] == list(STRATEGIES)
    assert all(row["total_runs"] == 3 for row in rows)
    assert next(row for row in rows if row["strategy"] == "none")[
        "deception_success_rate"
    ] == 0.0


def test_run_summaries_are_capped_but_metrics_use_every_run():
    experiment = experiment_service.run_experiment(
        strategy="random", runs=30, compare_strategies=False
    )

    assert experiment["metrics"]["total_runs"] == 30
    assert len(experiment["runs"]) == MAX_RUN_SUMMARIES
    assert experiment["truncated_runs"] == 30 - MAX_RUN_SUMMARIES


@pytest.mark.parametrize("runs", [0, -3, 101])
def test_invalid_run_count_is_rejected(runs):
    with pytest.raises(InvalidExperimentError):
        experiment_service.run_experiment(runs=runs)


def test_invalid_configuration_is_rejected():
    with pytest.raises(InvalidExperimentError):
        experiment_service.run_experiment(algorithm="Dijkstra")
    with pytest.raises(InvalidExperimentError):
        experiment_service.run_experiment(strategy="telepathy")
    with pytest.raises(InvalidExperimentError):
        experiment_service.run_experiment(start_node="Mainframe")


# ---- API ----


def test_run_endpoint_returns_a_stored_experiment():
    response = client.post(
        "/api/experiments/run",
        json={"algorithm": "BFS", "strategy": "greedy", "runs": 4, "seed": 2},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["experiment_id"]
    assert body["configuration"]["algorithm"] == "BFS"
    assert body["metrics"]["total_runs"] == 4
    assert len(body["strategy_comparison"]) == len(STRATEGIES)
    assert body["explanation"]

    fetched = client.get(f"/api/experiments/{body['experiment_id']}")
    assert fetched.status_code == 200
    assert fetched.json() == body


def test_get_endpoint_404s_for_an_unknown_experiment():
    response = client.get("/api/experiments/not-an-experiment")
    assert response.status_code == 404
    assert "not-an-experiment" in response.json()["detail"]


def test_run_endpoint_validates_the_run_count():
    too_many = client.post("/api/experiments/run", json={"runs": 500})
    assert too_many.status_code == 422

    too_few = client.post("/api/experiments/run", json={"runs": 0})
    assert too_few.status_code == 422


def test_run_endpoint_404s_are_not_raised_for_unknown_nodes():
    response = client.post("/api/experiments/run", json={"start_node": "Mainframe"})
    assert response.status_code == 422
    assert "Mainframe" in response.json()["detail"]
