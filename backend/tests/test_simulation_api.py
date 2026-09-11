"""
test_simulation_api.py
Covers the network and simulation endpoints that wrap the existing AI modules.
"""

from fastapi.testclient import TestClient

from app.main import app
from simulation.network import ATTACKER_START, CRITICAL_TARGET

client = TestClient(app)


def test_get_network_returns_topology():
    response = client.get("/api/network")
    assert response.status_code == 200

    body = response.json()
    assert body["attacker_start"] == ATTACKER_START
    assert body["critical_target"] == CRITICAL_TARGET
    assert len(body["nodes"]) == 7
    assert len(body["edges"]) == 9

    database = next(node for node in body["nodes"] if node["id"] == CRITICAL_TARGET)
    assert database["criticality"] == "high"
    assert CRITICAL_TARGET not in body["honeypot_candidates"]

    for edge in body["edges"]:
        assert edge["weight"] > 0


def test_simulate_with_bfs_returns_fewest_hop_path():
    response = client.post("/api/simulate", json={"algorithm": "BFS"})
    assert response.status_code == 200

    body = response.json()
    assert body["algorithm"] == "BFS"
    assert body["start_node"] == ATTACKER_START
    assert body["target_node"] == CRITICAL_TARGET
    # Same assertion the existing search tests make about BFS on this graph.
    assert body["path"] == ["Internet", "Web Server", "Application Server", "Database"]
    assert body["path_cost"] == 8
    assert body["nodes_explored"] > 0
    assert body["result"] in {"intercepted", "target_reached"}
    assert body["explanation"]


def test_simulate_with_astar_returns_minimum_cost_path():
    response = client.post("/api/simulate", json={"algorithm": "A*"})
    assert response.status_code == 200

    body = response.json()
    assert body["algorithm"] == "A*"
    # A* must match UCS's optimal cost on this graph.
    ucs = client.post("/api/simulate", json={"algorithm": "UCS"}).json()
    assert body["path_cost"] == ucs["path_cost"] == 8
    assert len(body["algorithm_comparison"]) == 4


def test_simulate_honeypot_settings_are_respected():
    response = client.post("/api/simulate", json={"algorithm": "UCS", "honeypot_count": 3})
    assert response.status_code == 200

    body = response.json()
    assert len(body["honeypots"]) == 3
    assert CRITICAL_TARGET not in body["honeypots"]
    assert sum(1 for row in body["honeypot_scores"] if row["selected"]) == 3

    if body["result"] == "intercepted":
        assert body["intercepted_at"] in body["honeypots"]
        assert body["intercepted_at_step"] is not None


def test_simulate_rejects_unknown_algorithm():
    response = client.post("/api/simulate", json={"algorithm": "Dijkstra"})
    assert response.status_code == 422


def test_simulate_rejects_unknown_node():
    response = client.post("/api/simulate", json={"algorithm": "BFS", "start_node": "Mainframe"})
    assert response.status_code == 404
    assert "Mainframe" in response.json()["detail"]
