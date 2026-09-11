"""
deception_game.py
The attacker-versus-defender decision problem expressed as a two-player game,
so Minimax and Alpha-Beta can reason about it.

MAX is the attacker (moving one hop per turn); MIN is the defender (spending
its honeypot budget, or passing). Utilities are scored from the attacker's view:
positive means the attacker is doing well, negative means deception is working.
"""

from dataclasses import dataclass, replace
from typing import Any

import networkx as nx

from ai.optimizer import DEPLOYMENT_COST

ATTACKER = "attacker"
DEFENDER = "defender"
PASS = ("pass", None)


@dataclass(frozen=True)
class GameState:
    """One position in the attacker-defender game."""

    attacker_node: str
    turn: str
    honeypots: frozenset[str]
    compromised: frozenset[str]
    budget_left: int
    movement_cost: int = 0
    deployment_cost: int = 0
    intercepted: bool = False
    reached_target: bool = False


@dataclass(frozen=True)
class UtilityWeights:
    """
    Transparent weighting of the five factors in the utility function.

    Assumption: all factors are expressed on comparable small scales, so the
    weights below are directly readable as relative importance.
    """

    progress: float = 10.0
    compromise: float = 2.0
    protection: float = 4.0
    deception: float = 50.0
    cost: float = 0.5


class DeceptionGame:
    """`ai.game.Game` implementation for the honeypot deception scenario."""

    def __init__(
        self,
        graph: nx.Graph,
        start: str,
        target: str,
        weights: UtilityWeights | None = None,
    ) -> None:
        self.graph = graph
        self.start = start
        self.target = target
        self.weights = weights or UtilityWeights()
        # Hop distances to the target, precomputed once for the utility function.
        self._distance = nx.single_source_shortest_path_length(graph, target)

    def initial_state(self, honeypot_budget: int) -> GameState:
        """The attacker at its entry point, the defender holding its full budget."""
        return GameState(
            attacker_node=self.start,
            turn=ATTACKER,
            honeypots=frozenset(),
            compromised=frozenset([self.start]),
            budget_left=max(0, honeypot_budget),
        )

    def eligible_honeypots(self, state: GameState) -> list[str]:
        """Nodes the defender may fortify: never the entry point or the asset."""
        return sorted(
            node
            for node in self.graph.nodes
            if node not in {self.start, self.target}
            and node not in state.honeypots
            and node not in state.compromised
        )

    # ---- Game protocol ----

    def actions(self, state: GameState) -> list[Any]:
        if self.is_terminal(state):
            return []

        if state.turn == ATTACKER:
            return [("move", node) for node in sorted(self.graph.neighbors(state.attacker_node))]

        if state.budget_left <= 0:
            return [PASS]
        return [("place", node) for node in self.eligible_honeypots(state)] + [PASS]

    def result(self, state: GameState, action: Any) -> GameState:
        kind, node = action

        if kind == "move":
            cost = self.graph[state.attacker_node][node]["weight"]
            return replace(
                state,
                attacker_node=node,
                turn=DEFENDER,
                compromised=state.compromised | ({node} if node not in state.honeypots else set()),
                movement_cost=state.movement_cost + cost,
                intercepted=node in state.honeypots,
                reached_target=node == self.target,
            )

        if kind == "place":
            return replace(
                state,
                turn=ATTACKER,
                honeypots=state.honeypots | {node},
                budget_left=state.budget_left - 1,
                deployment_cost=state.deployment_cost + DEPLOYMENT_COST.get(node, 1),
            )

        return replace(state, turn=ATTACKER)

    def is_terminal(self, state: GameState) -> bool:
        return state.intercepted or state.reached_target

    def is_max(self, state: GameState) -> bool:
        return state.turn == ATTACKER

    def utility(self, state: GameState) -> float:
        """
        Attacker-perspective score combining the five required factors.

        Terminal positions dominate: being deceived or reaching the asset
        outweighs any positional advantage.
        """
        weights = self.weights

        if state.intercepted:
            return -weights.deception
        if state.reached_target:
            return weights.deception

        distance = self._distance.get(state.attacker_node)
        progress = weights.progress / (1 + distance) if distance is not None else 0.0
        compromise = weights.compromise * len(state.compromised)
        protection = weights.protection * self._target_protection(state.honeypots)
        cost = weights.cost * (state.movement_cost + state.deployment_cost)

        return progress + compromise - protection - cost

    def _target_protection(self, honeypots: frozenset[str]) -> float:
        """How much of the asset's immediate neighbourhood is fortified."""
        neighbours = set(self.graph.neighbors(self.target))
        if not neighbours:
            return 0.0
        return len(neighbours & honeypots) / len(neighbours)
