"""
test_scenario_simulation.py
Alternative attack routes in /api/simulate, and running a simulation on a
saved scenario's topology instead of the built-in network.
"""

import networkx as nx
from fastapi.testclient import TestClient

from app.main import app
from app.services.simulation_service import alternative_paths, run_simulation
from simulation.network import build_network

client = TestClient(app)


def _node(node_id, node_type="honeypot_candidate", **metadata):
    return {"id": node_id, "name": node_id, "type": node_type, "criticality": "medium", "metadata": metadata}


# Entry -> two branches -> Vault. The cheap branch goes through Jump (cost 2),
# the expensive one through Relay (cost 6). Island is unreachable.
BRANCHED = {
    "name": "branched",
    "description": "two branches",
    "attacker_start": "Entry",
    "critical_target": "Vault",
    "nodes": [
        _node("Entry", "normal"),
        _node("Jump", deployment_cost=1),
        _node("Relay", deployment_cost=5),
        _node("Vault", "critical"),
        _node("Island"),
    ],
    "edges": [
        {"source": "Entry", "target": "Jump", "weight": 1},
        {"source": "Jump", "target": "Vault", "weight": 1},
        {"source": "Entry", "target": "Relay", "weight": 3},
        {"source": "Relay", "target": "Vault", "weight": 3},
    ],
}


# ---- Alternative routes ----

def test_alternative_paths_are_ranked_by_cost_and_match_networkx():
    graph = build_network()
    routes = alternative_paths(graph, "Internet", "Database", honeypots=["Web Server"])

    assert [route["rank"] for route in routes] == [1, 2, 3]
    costs = [route["cost"] for route in routes]
    assert costs == sorted(costs)
    assert costs[0] == nx.shortest_path_length(graph, "Internet", "Database", weight="weight")
    # Every route leaves the Internet through the Web Server, so every one is covered.
    assert all(route["honeypots_on_path"] == ["Web Server"] for route in routes)
    assert all(route["hops"] == len(route["path"]) - 1 for route in routes)


def test_alternative_paths_empty_when_unreachable():
    graph = nx.Graph()
    graph.add_nodes_from(["A", "B"])
    assert alternative_paths(graph, "A", "B", honeypots=[]) == []


def test_simulate_reports_alternative_routes():
    body = client.post("/api/simulate", json={"algorithm": "UCS"}).json()

    assert len(body["alternative_paths"]) == 3
    assert body["alternative_paths"][0]["cost"] == body["path_cost"]
    assert body["scenario_id"] is None


def test_explanations_name_the_selected_target():
    result = run_simulation(algorithm="UCS", target_node="File Server", honeypot_count=1)
    text = " ".join(result["explanation"])
    assert "File Server" in text
    assert "critical Database" not in text
    assert "File Server" not in result["honeypots"]


# ---- Saved-scenario simulation (service level) ----

def _scenario_dict(payload, scenario_id=7):
    candidates = [n["id"] for n in payload["nodes"] if n["id"] not in (payload["attacker_start"], payload["critical_target"])]
    return {**payload, "id": scenario_id, "honeypot_candidates": candidates}


def test_simulation_runs_on_a_saved_topology():
    result = run_simulation(algorithm="UCS", honeypot_count=1, scenario=_scenario_dict(BRANCHED))

    assert result["start_node"] == "Entry"
    assert result["target_node"] == "Vault"
    assert result["path"] == ["Entry", "Jump", "Vault"]
    assert result["path_cost"] == 2
    assert result["scenario_id"] == 7
    # Jump is on both cheap routes and costs 1 to deploy; Relay costs 5.
    assert result["honeypots"] == ["Jump"]
    assert result["result"] == "intercepted"
    costs = {row["node"]: row["deployment_cost"] for row in result["honeypot_scores"]}
    assert costs["Relay"] == 5


def test_saved_topology_with_an_unreachable_target():
    result = run_simulation(algorithm="BFS", target_node="Island", scenario=_scenario_dict(BRANCHED))

    assert result["path"] == []
    assert result["result"] == "no_path"
    assert result["alternative_paths"] == []
    assert any("No route exists" in line for line in result["explanation"])


# ---- Saved-scenario simulation (HTTP) ----

def test_simulate_endpoint_uses_a_saved_scenario(db_client):
    scenario_id = db_client.post("/api/scenarios", json=BRANCHED).json()["id"]

    response = db_client.post(
        "/api/simulate", json={"algorithm": "A*", "honeypot_count": 1, "scenario_id": scenario_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["scenario_id"] == scenario_id
    assert body["path"] == ["Entry", "Jump", "Vault"]
    assert [route["path"] for route in body["alternative_paths"]] == [
        ["Entry", "Jump", "Vault"],
        ["Entry", "Relay", "Vault"],
    ]


def test_simulate_endpoint_unknown_scenario_is_404(db_client):
    response = db_client.post("/api/simulate", json={"scenario_id": 999})
    assert response.status_code == 404
    assert "999" in response.json()["detail"]


def test_simulate_endpoint_rejects_nodes_outside_the_scenario(db_client):
    scenario_id = db_client.post("/api/scenarios", json=BRANCHED).json()["id"]
    response = db_client.post(
        "/api/simulate", json={"scenario_id": scenario_id, "start_node": "Internet"}
    )
    assert response.status_code == 404
    assert "Unknown node 'Internet'" in response.json()["detail"]


def test_simulate_endpoint_rejects_invalid_scenario_ids(db_client):
    assert db_client.post("/api/simulate", json={"scenario_id": 0}).status_code == 422
