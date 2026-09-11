"""
agents.py
Thin agent wrappers over the existing AI modules.

Neither agent implements search or scoring itself — the attacker delegates to
`ai.attacker` (BFS/DFS/UCS/A*) and the defender to `ai.defender` / `ai.optimizer`.
These classes only add the agent-level policy the stepped simulation needs.
"""

from typing import Any

import networkx as nx

from ai.attacker import ALGORITHMS, run_all_algorithms, select_attacker_path
from ai.defender import plan_defense
from simulation.network import honeypot_candidates


class AttackerAgent:
    """Goal-based agent: plans a route to the target, then walks it one hop at a time."""

    def __init__(self, algorithm: str) -> None:
        if algorithm not in ALGORITHMS:
            raise ValueError(f"Unsupported algorithm '{algorithm}'.")
        self.algorithm = algorithm

    def plan(self, graph: nx.Graph, start: str, target: str) -> dict[str, Any]:
        """Predicts the attacker's route using the selected search strategy."""
        return select_attacker_path(graph, start, target, self.algorithm)

    @staticmethod
    def plausible_paths(graph: nx.Graph, start: str, target: str) -> list[list[str]]:
        """Routes from every algorithm — what the defender reasons about."""
        results = run_all_algorithms(graph, start, target)
        return [result["path"] for result in results.values() if result["path"]]


class DefenderAgent:
    """Utility-based agent: spends a honeypot budget on the highest-value nodes."""

    def __init__(self, budget: int) -> None:
        self.budget = max(0, budget)

    def place(
        self,
        graph: nx.Graph,
        candidate_paths: list[list[str]],
        start: str,
        target: str,
    ) -> tuple[list[dict[str, Any]], list[str], list[str]]:
        """
        Scores honeypot locations and selects up to `budget` of them.

        The attacker's entry point and the protected asset are never eligible:
        a honeypot on either would make the scenario meaningless.
        Returns (scored_table, selected_nodes, explanation_lines).
        """
        eligible = [
            node for node in honeypot_candidates(graph) if node not in {start, target}
        ]

        if self.budget == 0 or not eligible:
            return [], [], [
                "The defender deployed no honeypots, so the attacker's route is unopposed."
            ]

        table, selected = plan_defense(
            graph, candidate_paths, candidates=eligible, target=target, top_n=self.budget
        )

        explanation = [
            f"The defender scored {len(table)} eligible node(s) by deception value: "
            "attack-path frequency plus proximity to the protected asset plus connectivity, "
            "divided by deployment cost.",
        ]
        if table:
            top = table[0]
            explanation.append(
                f"{top['node']} scored highest at {top['deception_score']} "
                f"(path frequency {top['attack_path_frequency']}, proximity "
                f"{top['target_proximity']}, connectivity {top['node_connectivity']}, "
                f"cost {top['deployment_cost']})."
            )
        explanation.append(
            f"Honeypots were deployed at {', '.join(selected)} — never on the entry point "
            f"({start}) or the protected asset ({target})."
        )
        return table, selected, explanation
