"""
test_ai_api.py
Covers POST /api/ai/analyze for every registered technique.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.ai_registry import TECHNIQUES
from simulation.network import ATTACKER_START, CRITICAL_TARGET

client = TestClient(app)


def analyze(**overrides) -> dict:
    payload = {"technique": "minimax", "honeypot_budget": 2, "depth": 3, "seed": 5, **overrides}
    response = client.post("/api/ai/analyze", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("technique", TECHNIQUES)
def test_every_technique_returns_a_structured_result(technique):
    body = analyze(technique=technique)

    assert body["technique"] == technique
    assert body["start_node"] == ATTACKER_START
    assert body["target_node"] == CRITICAL_TARGET
    assert body["recommendation"]
    assert isinstance(body["score"], float)
    assert body["explanation"]
    assert isinstance(body["metrics"], dict)


def test_alpha_beta_agrees_with_minimax_through_the_api():
    minimax = analyze(technique="minimax", depth=3)
    alpha_beta = analyze(technique="alpha_beta", depth=3)

    assert alpha_beta["recommendation"] == minimax["recommendation"]
    assert alpha_beta["score"] == pytest.approx(minimax["score"])
    assert alpha_beta["metrics"]["nodes_visited"] <= minimax["metrics"]["nodes_visited"]
    assert alpha_beta["metrics"]["branches_pruned"] >= 0


def test_bayesian_reports_a_route_probability():
    body = analyze(technique="bayesian")

    assert 0.0 <= body["score"] <= 1.0
    assert body["probability"] is not None
    assert 0.0 <= body["probability"] <= 1.0
    assert body["metrics"]["predicted_path"][0] == ATTACKER_START
    assert len(body["metrics"]["node_risks"]) == 7


@pytest.mark.parametrize("technique", ["hill_climbing", "genetic_algorithm"])
def test_optimizers_return_a_budgeted_placement(technique):
    body = analyze(technique=technique, honeypot_budget=2)

    assert len(body["honeypots"]) == 2
    assert ATTACKER_START not in body["honeypots"]
    assert CRITICAL_TARGET not in body["honeypots"]
    assert body["score"] > 0


@pytest.mark.parametrize("technique", ["hill_climbing", "genetic_algorithm"])
def test_optimizers_accept_a_zero_budget(technique):
    body = analyze(technique=technique, honeypot_budget=0)

    assert body["honeypots"] == []
    assert body["recommendation"] == "no honeypots"


def test_invalid_technique_is_rejected():
    response = client.post("/api/ai/analyze", json={"technique": "deep_learning"})
    assert response.status_code == 422


def test_unknown_node_returns_404():
    response = client.post(
        "/api/ai/analyze", json={"technique": "bayesian", "start_node": "Mainframe"}
    )
    assert response.status_code == 404
    assert "Mainframe" in response.json()["detail"]


def test_existing_simulate_endpoint_is_unaffected():
    response = client.post("/api/simulate", json={"algorithm": "BFS"})
    assert response.status_code == 200
    assert response.json()["path_cost"] == 8
