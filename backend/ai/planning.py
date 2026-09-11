"""
planning.py
Classical state-space planning over a simplified defensive domain.

States are sets of ground literals (STRIPS style) and actions carry
preconditions, add-effects, and delete-effects. Forward search plans from the
initial state toward the goal; backward search regresses from the goal toward
the initial state. Both share one action generator, so the two methods reason
about exactly the same domain.

Simplification (documented assumption): the honeypot budget is enforced by
counting `honeypot(...)` literals rather than modelling numeric fluents. In
backward search this is checked against each regressed subgoal, which is a
sound lower bound on the honeypots any plan would need.

The network itself comes from `simulation.network` — no second model here.
"""

from collections import deque
from dataclasses import dataclass
from typing import Any, Callable

import networkx as nx

MAX_EXPLORED_STATES = 20000


@dataclass(frozen=True)
class Action:
    """One grounded planning action."""

    name: str
    parameters: tuple[str, ...]
    preconditions: frozenset[str]
    add_effects: frozenset[str]
    delete_effects: frozenset[str]
    cost: int = 1

    def __str__(self) -> str:
        return f"{self.name}({', '.join(self.parameters)})"

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "parameters": list(self.parameters),
            "cost": self.cost,
            "description": str(self),
        }


# ---- Literal helpers ----

def at(node: str) -> str:
    return f"at({node})"


def honeypot(node: str) -> str:
    return f"honeypot({node})"


def protected(node: str) -> str:
    return f"protected({node})"


def monitored(node: str) -> str:
    return f"monitored({node})"


def isolated(node: str) -> str:
    return f"isolated({node})"


def compromised(node: str) -> str:
    return f"compromised({node})"


def blocked(u: str, v: str) -> str:
    first, second = sorted((u, v))
    return f"blocked({first},{second})"


def honeypot_count(state: frozenset[str]) -> int:
    return sum(1 for literal in state if literal.startswith("honeypot("))


class DefensivePlanningDomain:
    """
    Grounded actions for defending a network against an in-progress intrusion.

    Actions: place_honeypot, move_attacker, block_route, increase_protection,
    monitor_node, isolate_node.
    """

    def __init__(self, graph: nx.Graph, start: str, target: str, honeypot_budget: int) -> None:
        self.graph = graph
        self.start = start
        self.target = target
        self.honeypot_budget = max(0, honeypot_budget)
        self.nodes = sorted(graph.nodes)
        # Honeypots never go on the attacker's entry point or the protected asset.
        self.eligible = [node for node in self.nodes if node not in {start, target}]

    def initial_state(self) -> frozenset[str]:
        return frozenset({at(self.start), compromised(self.start)})

    def actions(self) -> list[Action]:
        """Every grounded action in the domain, in a deterministic order."""
        actions: list[Action] = []

        for node in self.eligible:
            actions.append(
                Action(
                    name="place_honeypot",
                    parameters=(node,),
                    preconditions=frozenset(),
                    add_effects=frozenset({honeypot(node)}),
                    delete_effects=frozenset(),
                    cost=2,
                )
            )

        for source in self.nodes:
            for destination in sorted(self.graph.neighbors(source)):
                actions.append(
                    Action(
                        name="move_attacker",
                        parameters=(source, destination),
                        preconditions=frozenset({at(source)}),
                        add_effects=frozenset({at(destination), compromised(destination)}),
                        delete_effects=frozenset(
                            {at(source), blocked(source, destination), isolated(destination)}
                        ),
                        cost=self.graph[source][destination]["weight"],
                    )
                )

        # Only routes into the protected asset are worth severing.
        for neighbour in sorted(self.graph.neighbors(self.target)):
            actions.append(
                Action(
                    name="block_route",
                    parameters=(neighbour, self.target),
                    preconditions=frozenset(),
                    add_effects=frozenset({blocked(neighbour, self.target)}),
                    delete_effects=frozenset(),
                    cost=3,
                )
            )

        for node in self.nodes:
            actions.append(
                Action(
                    name="increase_protection",
                    parameters=(node,),
                    preconditions=frozenset(),
                    add_effects=frozenset({protected(node)}),
                    delete_effects=frozenset(),
                    cost=2,
                )
            )
            actions.append(
                Action(
                    name="monitor_node",
                    parameters=(node,),
                    preconditions=frozenset(),
                    add_effects=frozenset({monitored(node)}),
                    delete_effects=frozenset(),
                    cost=1,
                )
            )

        for node in self.eligible:
            actions.append(
                Action(
                    name="isolate_node",
                    parameters=(node,),
                    preconditions=frozenset({compromised(node)}),
                    add_effects=frozenset({isolated(node)}),
                    delete_effects=frozenset({at(node)}),
                    cost=2,
                )
            )

        return actions

    def is_applicable(self, action: Action, state: frozenset[str]) -> bool:
        """Preconditions hold, effects change something, and the budget allows it."""
        if not action.preconditions <= state:
            return False
        if action.add_effects <= state and not (action.delete_effects & state):
            return False  # no-op
        if action.name == "place_honeypot" and honeypot_count(state) >= self.honeypot_budget:
            return False
        return True

    def apply(self, action: Action, state: frozenset[str]) -> frozenset[str]:
        return (state - action.delete_effects) | action.add_effects

    def budget_feasible(self, subgoal: frozenset[str]) -> bool:
        """A subgoal needing more honeypots than the budget can never be reached."""
        return honeypot_count(subgoal) <= self.honeypot_budget


# ---- Goals ----

GOAL_TYPES = ("protect_target", "intercept_attacker", "contain_breach")


def build_goal(
    domain: DefensivePlanningDomain, goal_type: str
) -> tuple[frozenset[str], str]:
    """Returns the goal literals and a human-readable description."""
    if goal_type == "intercept_attacker":
        # Lure the attacker onto a fortified host next to its current position.
        neighbours = sorted(domain.graph.neighbors(domain.start))
        lure = next((node for node in neighbours if node in domain.eligible), None)
        if lure is None:
            return frozenset(), "no eligible host adjacent to the attacker"
        return (
            frozenset({honeypot(lure), at(lure)}),
            f"draw the attacker onto a honeypot at {lure}",
        )

    if goal_type == "contain_breach":
        return (
            frozenset({monitored(domain.target), protected(domain.target)}),
            f"place the protected asset {domain.target} under monitoring and hardening",
        )

    # Default: every route into the asset is fortified or severed. Honeypots go
    # to the best-connected approaches first; the budget decides how many, and
    # the remaining routes are severed instead, so the goal stays reachable.
    neighbours = sorted(
        domain.graph.neighbors(domain.target),
        key=lambda node: (-domain.graph.degree(node), node),
    )
    fortify = [
        node for node in neighbours if node in domain.eligible
    ][: domain.honeypot_budget]

    literals = {
        honeypot(node) if node in fortify else blocked(node, domain.target)
        for node in neighbours
    }
    return (
        frozenset(literals),
        f"fortify or sever every route into {domain.target}",
    )


# ---- Planners ----

def validate_plan(
    domain: "DefensivePlanningDomain", plan: list[Action], goal: frozenset[str]
) -> tuple[bool, frozenset[str]]:
    """Replays a plan from the initial state and reports whether it reaches the goal."""
    state = domain.initial_state()
    for action in plan:
        if not domain.is_applicable(action, state):
            return False, state
        state = domain.apply(action, state)
    return goal <= state, state


@dataclass
class PlanResult:
    """Outcome of one planning run."""

    method: str
    success: bool
    actions: list[Action]
    explored_states: int
    final_state: frozenset[str]
    goal_description: str
    reason: str = ""

    @property
    def cost(self) -> int:
        return sum(action.cost for action in self.actions)

    def to_dict(self) -> dict[str, Any]:
        return {
            "method": self.method,
            "success": self.success,
            "actions": [action.to_dict() for action in self.actions],
            "plan_length": len(self.actions),
            "plan_cost": self.cost,
            "explored_states": self.explored_states,
            "final_state": sorted(self.final_state),
            "goal": self.goal_description,
            "reason": self.reason,
        }


def forward_plan(
    domain: DefensivePlanningDomain,
    goal: frozenset[str],
    max_depth: int = 4,
    max_states: int = MAX_EXPLORED_STATES,
) -> PlanResult:
    """
    Breadth-first progression from the initial state.

    Visited states are deduplicated, so the search always terminates; it also
    stops once `max_depth` or `max_states` is reached.
    """
    initial = domain.initial_state()
    goal_test: Callable[[frozenset[str]], bool] = lambda state: goal <= state

    if not goal:
        return PlanResult(
            "forward", False, [], 0, initial, "", "no goal condition could be built"
        )
    if goal_test(initial):
        return PlanResult("forward", True, [], 1, initial, "", "goal already satisfied")

    actions = domain.actions()
    frontier: deque[tuple[frozenset[str], list[Action]]] = deque([(initial, [])])
    visited = {initial}
    explored = 0

    while frontier:
        state, plan = frontier.popleft()
        explored += 1
        if explored > max_states:
            return PlanResult(
                "forward", False, [], explored, state, "", "state limit reached"
            )
        if len(plan) >= max_depth:
            continue

        for action in actions:
            if not domain.is_applicable(action, state):
                continue
            successor = domain.apply(action, state)
            if successor in visited:
                continue

            if goal_test(successor):
                return PlanResult("forward", True, [*plan, action], explored, successor, "")

            visited.add(successor)
            frontier.append((successor, [*plan, action]))

    return PlanResult(
        "forward", False, [], explored, initial, "", f"no plan within depth {max_depth}"
    )


def backward_plan(
    domain: DefensivePlanningDomain,
    goal: frozenset[str],
    max_depth: int = 4,
    max_states: int = MAX_EXPLORED_STATES,
) -> PlanResult:
    """
    Breadth-first regression from the goal.

    A subgoal is regressed through any action that achieves part of it without
    deleting another part; the search succeeds when a subgoal holds in the
    initial state. Visited subgoals are deduplicated to guarantee termination.
    """
    initial = domain.initial_state()

    if not goal:
        return PlanResult(
            "backward", False, [], 0, initial, "", "no goal condition could be built"
        )
    if goal <= initial:
        return PlanResult("backward", True, [], 1, initial, "", "goal already satisfied")

    actions = domain.actions()
    frontier: deque[tuple[frozenset[str], list[Action]]] = deque([(goal, [])])
    visited = {goal}
    explored = 0

    while frontier:
        subgoal, plan = frontier.popleft()
        explored += 1
        if explored > max_states:
            return PlanResult(
                "backward", False, [], explored, initial, "", "state limit reached"
            )
        if len(plan) >= max_depth:
            continue

        for action in actions:
            # Relevant: achieves part of the subgoal without undoing the rest.
            if not action.add_effects & subgoal:
                continue
            if action.delete_effects & subgoal:
                continue

            regressed = (subgoal - action.add_effects) | action.preconditions
            if not domain.budget_feasible(regressed):
                continue

            candidate = [action, *plan]
            if regressed <= initial:
                # Regression ignores the budget guard, so confirm the plan really
                # runs forward from the initial state before accepting it.
                achieved, final = validate_plan(domain, candidate, goal)
                if achieved:
                    return PlanResult("backward", True, candidate, explored, final, "")

            if regressed in visited:
                continue
            visited.add(regressed)
            frontier.append((regressed, candidate))

    return PlanResult(
        "backward", False, [], explored, initial, "", f"no plan within depth {max_depth}"
    )
