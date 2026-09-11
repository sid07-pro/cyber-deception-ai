"""
test_planning.py
Covers forward and backward defensive planning, plus the planning endpoint.
"""

import pytest
from fastapi.testclient import TestClient

from ai.planning import (
    DefensivePlanningDomain,
    backward_plan,
    build_goal,
    forward_plan,
    honeypot,
    validate_plan,
)
from app.main import app
from app.services import planning_service
from simulation.network import ATTACKER_START, CRITICAL_TARGET, build_network

client = TestClient(app)

PLANNERS = [forward_plan, backward_plan]


def make_domain(budget: int = 2) -> DefensivePlanningDomain:
    return DefensivePlanningDomain(build_network(), ATTACKER_START, CRITICAL_TARGET, budget)


@pytest.mark.parametrize("planner", PLANNERS)
@pytest.mark.parametrize(
    "goal_type", ["protect_target", "intercept_attacker", "contain_breach"]
)
def test_planner_finds_a_valid_plan(planner, goal_type):
    domain = make_domain()
    goal, _ = build_goal(domain, goal_type)

    result = planner(domain, goal, max_depth=4)

    assert result.success
    assert result.actions
    assert result.explored_states > 0
    # The plan must actually run from the initial state and reach the goal.
    achieved, _ = validate_plan(domain, result.actions, goal)
    assert achieved


def test_forward_plan_places_honeypots_within_budget():
    domain = make_domain(budget=2)
    goal, _ = build_goal(domain, "protect_target")

    result = forward_plan(domain, goal, max_depth=4)

    placements = [a for a in result.actions if a.name == "place_honeypot"]
    assert len(placements) <= 2
    for action in placements:
        assert action.parameters[0] not in {ATTACKER_START, CRITICAL_TARGET}


@pytest.mark.parametrize("planner", PLANNERS)
def test_planner_reports_no_plan_when_the_depth_is_too_small(planner):
    domain = make_domain()
    goal, _ = build_goal(domain, "protect_target")  # needs three actions

    result = planner(domain, goal, max_depth=1)

    assert result.success is False
    assert result.actions == []
    assert "no plan" in result.reason


@pytest.mark.parametrize("planner", PLANNERS)
def test_planner_succeeds_immediately_when_the_goal_already_holds(planner):
    domain = make_domain()
    result = planner(domain, domain.initial_state(), max_depth=3)

    assert result.success
    assert result.actions == []
    assert result.reason == "goal already satisfied"


@pytest.mark.parametrize("planner", PLANNERS)
def test_planner_rejects_an_empty_goal(planner):
    domain = make_domain()
    result = planner(domain, frozenset(), max_depth=3)

    assert result.success is False
    assert "no goal" in result.reason


def test_zero_budget_makes_honeypot_goals_unreachable():
    domain = make_domain(budget=0)
    goal = frozenset({honeypot("Web Server")})

    assert domain.budget_feasible(goal) is False
    assert forward_plan(domain, goal, max_depth=3).success is False
    assert backward_plan(domain, goal, max_depth=3).success is False


# ---- Service and API ----


def test_service_rejects_unknown_method_and_goal():
    with pytest.raises(planning_service.UnknownMethodError):
        planning_service.plan(method="sideways")
    with pytest.raises(planning_service.UnknownGoalError):
        planning_service.plan(goal_type="win")
    with pytest.raises(planning_service.UnknownNodeError):
        planning_service.plan(start_node="Mainframe")


@pytest.mark.parametrize("method", ["forward", "backward"])
def test_planning_endpoint_returns_a_plan(method):
    response = client.post(
        "/api/planning/plan",
        json={"method": method, "goal_type": "protect_target", "max_depth": 4},
    )
    assert response.status_code == 200

    body = response.json()
    assert body["method"] == method
    assert body["success"] is True
    assert body["plan_length"] == len(body["actions"])
    assert body["plan_cost"] > 0
    assert body["explored_states"] > 0
    assert body["goal"]
    assert body["explanation"]
    for action in body["actions"]:
        assert action["description"].startswith(action["name"])


def test_planning_endpoint_reports_failure_without_raising():
    response = client.post(
        "/api/planning/plan", json={"method": "forward", "max_depth": 1}
    )
    assert response.status_code == 200

    body = response.json()
    assert body["success"] is False
    assert body["actions"] == []
    assert "no plan" in body["reason"]


def test_planning_endpoint_validates_input():
    invalid_method = client.post("/api/planning/plan", json={"method": "sideways"})
    assert invalid_method.status_code == 422

    invalid_depth = client.post("/api/planning/plan", json={"max_depth": 0})
    assert invalid_depth.status_code == 422

    unknown_node = client.post("/api/planning/plan", json={"start_node": "Mainframe"})
    assert unknown_node.status_code == 404
    assert "Mainframe" in unknown_node.json()["detail"]
