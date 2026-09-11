"""
test_persistence.py
Covers the ORM models, the persistence service, and the persistence endpoints.
Runs entirely on a temporary SQLite database (see conftest.py).
"""

import pytest
from sqlalchemy import inspect

from app.models.scenario import ExperimentRecord, Scenario
from app.services import experiment_service, persistence_service
from app.services.experiment_service import experiment_store
from app.services.persistence_service import (
    DuplicateScenarioError,
    InvalidScenarioError,
    ScenarioNotFoundError,
    StoredExperimentNotFoundError,
)


@pytest.fixture(autouse=True)
def clean_experiment_store():
    experiment_store.clear()
    yield
    experiment_store.clear()


def payload(name: str = "demo") -> dict:
    return {
        "name": name,
        "description": "a small test network",
        "attacker_start": "Internet",
        "critical_target": "Database",
        "nodes": [
            {"id": "Internet", "name": "Internet", "type": "normal", "criticality": "low", "metadata": {}},
            {
                "id": "Web Server",
                "name": "Web Server",
                "type": "honeypot_candidate",
                "criticality": "medium",
                "metadata": {"degree": 2},
            },
            {"id": "Database", "name": "Database", "type": "critical", "criticality": "high", "metadata": {}},
        ],
        "edges": [
            {"source": "Internet", "target": "Web Server", "weight": 1},
            {"source": "Web Server", "target": "Database", "weight": 5},
        ],
    }


# ---- Models ----


def test_tables_are_created(db_session):
    tables = set(inspect(db_session.get_bind()).get_table_names())
    assert {"scenarios", "scenario_nodes", "scenario_edges", "experiments"} <= tables


def test_scenario_persists_its_nodes_and_edges(db_session):
    scenario = persistence_service.create_scenario(db_session, payload())

    stored = db_session.get(Scenario, scenario.id)
    assert stored.name == "demo"
    assert len(stored.nodes) == 3
    assert len(stored.edges) == 2
    assert stored.created_at is not None
    assert next(n for n in stored.nodes if n.node_id == "Web Server").node_metadata == {"degree": 2}


def test_deleting_a_scenario_cascades(db_session):
    scenario = persistence_service.create_scenario(db_session, payload())
    experiment = experiment_service.run_experiment(runs=2, compare_strategies=False)
    persistence_service.save_experiment(db_session, experiment, scenario.id)

    persistence_service.delete_scenario(db_session, scenario.id)

    assert db_session.query(Scenario).count() == 0
    assert db_session.query(ExperimentRecord).count() == 0


# ---- Service validation ----


def test_duplicate_names_are_rejected(db_session):
    persistence_service.create_scenario(db_session, payload())
    with pytest.raises(DuplicateScenarioError):
        persistence_service.create_scenario(db_session, payload())


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p.update(attacker_start="Mainframe"),
        lambda p: p.update(critical_target="Internet", attacker_start="Internet"),
        lambda p: p["edges"].append({"source": "Internet", "target": "Ghost", "weight": 2}),
        lambda p: p["edges"].append({"source": "Internet", "target": "Database", "weight": 0}),
        lambda p: p.update(nodes=[]),
    ],
)
def test_invalid_topologies_are_rejected(db_session, mutate):
    data = payload()
    mutate(data)
    with pytest.raises(InvalidScenarioError):
        persistence_service.create_scenario(db_session, data)


def test_missing_scenario_raises(db_session):
    with pytest.raises(ScenarioNotFoundError):
        persistence_service.get_scenario(db_session, 999)


def test_missing_stored_experiment_raises(db_session):
    with pytest.raises(StoredExperimentNotFoundError):
        persistence_service.get_experiment(db_session, "nope")


def test_experiment_persistence_round_trip(db_session):
    experiment = experiment_service.run_experiment(runs=3, seed=9, compare_strategies=False)
    record = persistence_service.save_experiment(db_session, experiment)

    fetched = persistence_service.get_experiment(db_session, experiment["experiment_id"])
    assert fetched.id == record.id
    assert fetched.metrics == experiment["metrics"]
    assert fetched.runs == 3
    assert persistence_service.experiment_to_dict(fetched)["configuration"]["seed"] == 9


def test_experiment_list_is_capped_and_newest_first(db_session):
    ids = []
    for index in range(3):
        experiment = experiment_service.run_experiment(
            runs=1, seed=index, compare_strategies=False
        )
        persistence_service.save_experiment(db_session, experiment)
        ids.append(experiment["experiment_id"])

    listed = persistence_service.list_experiments(db_session, limit=2)
    assert len(listed) == 2
    assert listed[0].experiment_id == ids[-1]


# ---- API ----


def test_scenario_endpoints_round_trip(db_client):
    created = db_client.post("/api/scenarios", json=payload("saved-net"))
    assert created.status_code == 201
    scenario_id = created.json()["id"]
    assert created.json()["honeypot_candidates"] == ["Web Server"]

    listed = db_client.get("/api/scenarios")
    assert listed.status_code == 200
    assert listed.json()[0]["name"] == "saved-net"
    assert listed.json()[0]["node_count"] == 3

    fetched = db_client.get(f"/api/scenarios/{scenario_id}")
    assert fetched.status_code == 200
    assert len(fetched.json()["edges"]) == 2

    deleted = db_client.delete(f"/api/scenarios/{scenario_id}")
    assert deleted.status_code == 204
    assert db_client.get("/api/scenarios").json() == []


def test_save_current_network_endpoint(db_client):
    response = db_client.post(
        "/api/scenarios/save-current", json={"name": "built-in", "description": "default"}
    )
    assert response.status_code == 201

    body = response.json()
    assert body["attacker_start"] == "Internet"
    assert body["critical_target"] == "Database"
    assert len(body["nodes"]) == 7
    assert len(body["edges"]) == 9


def test_duplicate_scenario_name_returns_409(db_client):
    assert db_client.post("/api/scenarios", json=payload("dup")).status_code == 201
    conflict = db_client.post("/api/scenarios", json=payload("dup"))
    assert conflict.status_code == 409
    assert "dup" in conflict.json()["detail"]


def test_invalid_scenario_returns_422(db_client):
    data = payload("broken")
    data["attacker_start"] = "Mainframe"
    response = db_client.post("/api/scenarios", json=data)
    assert response.status_code == 422


def test_missing_scenario_returns_404(db_client):
    assert db_client.get("/api/scenarios/404").status_code == 404
    assert db_client.delete("/api/scenarios/404").status_code == 404


def test_empty_scenario_list_is_an_empty_array(db_client):
    response = db_client.get("/api/scenarios")
    assert response.status_code == 200
    assert response.json() == []


def test_experiment_history_endpoints(db_client):
    run = db_client.post("/api/experiments/run", json={"runs": 2, "strategy": "greedy"})
    assert run.status_code == 200
    experiment_id = run.json()["experiment_id"]

    saved = db_client.post("/api/experiments/save", json={"experiment_id": experiment_id})
    assert saved.status_code == 201
    assert saved.json()["metrics"]["total_runs"] == 2

    history = db_client.get("/api/experiments-history")
    assert history.status_code == 200
    assert history.json()[0]["experiment_id"] == experiment_id
    assert history.json()[0]["strategy"] == "greedy"

    fetched = db_client.get(f"/api/experiments-history/{experiment_id}")
    assert fetched.status_code == 200
    assert fetched.json()["explanation"]


def test_saving_an_unknown_experiment_returns_404(db_client):
    response = db_client.post("/api/experiments/save", json={"experiment_id": "nope"})
    assert response.status_code == 404


def test_saving_against_an_unknown_scenario_returns_404(db_client):
    run = db_client.post("/api/experiments/run", json={"runs": 1}).json()
    response = db_client.post(
        "/api/experiments/save", json={"experiment_id": run["experiment_id"], "scenario_id": 999}
    )
    assert response.status_code == 404


def test_existing_endpoints_still_work(db_client):
    """Regression guard: persistence must not disturb the simulation API."""
    assert db_client.get("/api/health").json()["status"] == "ok"
    assert len(db_client.get("/api/network").json()["nodes"]) == 7
    assert db_client.post("/api/simulate", json={"algorithm": "BFS"}).json()["path_cost"] == 8

    started = db_client.post("/api/simulation/start", json={"algorithm": "A*"}).json()
    assert started["status"] == "running"
    assert db_client.post(
        "/api/simulation/step", json={"session_id": started["session_id"]}
    ).json()["time_step"] == 1

    assert db_client.post("/api/ai/analyze", json={"technique": "bayesian"}).status_code == 200
    assert db_client.post("/api/planning/plan", json={"method": "forward"}).status_code == 200
