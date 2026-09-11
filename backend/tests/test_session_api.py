"""
test_session_api.py
Covers the stepped attacker-vs-defender simulation sessions.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.session_store import session_store
from simulation.network import ATTACKER_START, CRITICAL_TARGET

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_sessions():
    session_store.clear()
    yield
    session_store.clear()


def start(**overrides) -> dict:
    payload = {"algorithm": "A*", "honeypot_budget": 2, **overrides}
    response = client.post("/api/simulation/start", json=payload)
    assert response.status_code == 200
    return response.json()


def step(session_id: str) -> dict:
    response = client.post("/api/simulation/step", json={"session_id": session_id})
    assert response.status_code == 200
    return response.json()


def test_start_initializes_a_running_session():
    state = start()

    assert state["session_id"]
    assert state["status"] == "running"
    assert state["outcome"] is None
    assert state["is_complete"] is False
    assert state["time_step"] == 0
    assert state["path_index"] == 0

    assert state["start_node"] == ATTACKER_START
    assert state["target_node"] == CRITICAL_TARGET
    assert state["attacker_position"] == ATTACKER_START
    assert state["visited_nodes"] == [ATTACKER_START]
    assert state["predicted_path"][0] == ATTACKER_START
    assert state["predicted_path"][-1] == CRITICAL_TARGET
    assert state["path_cost"] == 8

    # The defender never fortifies the entry point or the asset itself.
    assert len(state["honeypots"]) == 2
    assert ATTACKER_START not in state["honeypots"]
    assert CRITICAL_TARGET not in state["honeypots"]
    assert state["explanation"]
    assert state["protection"]["risk_level"] in {"low", "medium", "high"}


def test_step_advances_the_attacker_one_hop():
    state = start(honeypot_budget=0)
    expected_next = state["predicted_path"][1]

    stepped = step(state["session_id"])

    assert stepped["time_step"] == 1
    assert stepped["path_index"] == 1
    assert stepped["attacker_position"] == expected_next
    assert stepped["visited_nodes"] == [ATTACKER_START, expected_next]
    assert expected_next in stepped["compromised_nodes"]
    assert stepped["current_event"]["kind"] in {"move", "compromise", "target_reached"}
    assert stepped["is_complete"] is False


def test_attacker_is_intercepted_by_a_honeypot():
    state = start()
    assert set(state["predicted_path"]) & set(state["honeypots"]), (
        "this scenario is only meaningful when the route crosses a honeypot"
    )

    while not state["is_complete"]:
        state = step(state["session_id"])

    assert state["outcome"] == "intercepted"
    assert state["attacker_position"] in state["honeypots"]
    assert CRITICAL_TARGET not in state["compromised_nodes"]
    assert state["current_event"]["kind"] == "intercepted"
    assert any(event["kind"] == "intercepted" for event in state["events"])


def test_attacker_reaches_the_target_without_honeypots():
    state = start(honeypot_budget=0)
    assert state["honeypots"] == []

    while not state["is_complete"]:
        state = step(state["session_id"])

    assert state["outcome"] == "target_reached"
    assert state["attacker_position"] == CRITICAL_TARGET
    assert CRITICAL_TARGET in state["compromised_nodes"]
    assert state["protection"]["risk_level"] == "high"

    # Stepping a finished simulation is a no-op, not an error.
    assert step(state["session_id"])["time_step"] == state["time_step"]


def test_reset_rewinds_the_session_but_keeps_its_configuration():
    state = start()
    session_id = state["session_id"]
    step(session_id)
    step(session_id)

    reset = client.post("/api/simulation/reset", json={"session_id": session_id})
    assert reset.status_code == 200

    body = reset.json()
    assert body["session_id"] == session_id
    assert body["algorithm"] == state["algorithm"]
    assert body["honeypot_budget"] == state["honeypot_budget"]
    assert body["time_step"] == 0
    assert body["path_index"] == 0
    assert body["attacker_position"] == ATTACKER_START
    assert body["visited_nodes"] == [ATTACKER_START]
    assert body["outcome"] is None
    assert body["honeypots"] == state["honeypots"]


def test_invalid_session_id_returns_404():
    for path in ("/api/simulation/step", "/api/simulation/reset"):
        response = client.post(path, json={"session_id": "not-a-session"})
        assert response.status_code == 404
        assert "not-a-session" in response.json()["detail"]


def test_unknown_start_node_returns_404():
    response = client.post(
        "/api/simulation/start", json={"algorithm": "BFS", "start_node": "Mainframe"}
    )
    assert response.status_code == 404
    assert "Mainframe" in response.json()["detail"]


def test_same_start_and_target_is_invalid():
    state = start(start_node=CRITICAL_TARGET, target_node=CRITICAL_TARGET)

    assert state["status"] == "completed"
    assert state["outcome"] == "invalid"
    assert state["predicted_path"] == []
