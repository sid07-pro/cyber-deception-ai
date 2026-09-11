"""
test_search.py
Sanity tests for BFS, DFS, UCS, A* and the full simulation pipeline.
Run with: pytest
"""

import networkx as nx

from ai.astar import astar_search
from ai.bfs import bfs_search
from ai.dfs import dfs_search
from ai.ucs import ucs_search
from simulation.network import ATTACKER_START, CRITICAL_TARGET, build_network
from simulation.simulator import run_full_simulation

ALGORITHMS = [
    ("BFS", bfs_search),
    ("DFS", dfs_search),
    ("UCS", ucs_search),
    ("A*", astar_search),
]


def test_all_algorithms_return_valid_paths():
    g = build_network()
    for name, fn in ALGORITHMS:
        path, cost, explored = fn(g, ATTACKER_START, CRITICAL_TARGET)
        assert len(path) > 0, f"{name}: returns non-empty path"
        assert path[0] == ATTACKER_START, f"{name}: path starts at attacker start"
        assert path[-1] == CRITICAL_TARGET, f"{name}: path ends at target"
        assert explored > 0, f"{name}: explored at least one node"

        # verify every consecutive pair is a real edge
        for i in range(len(path) - 1):
            assert g.has_edge(path[i], path[i + 1]), (
                f"{name}: edge {path[i]}->{path[i + 1]} exists in graph"
            )


def test_ucs_respects_edge_costs():
    g = build_network()
    _, ucs_cost, _ = ucs_search(g, ATTACKER_START, CRITICAL_TARGET)

    # brute force: check no simple path has a strictly lower cost
    all_paths = list(nx.all_simple_paths(g, ATTACKER_START, CRITICAL_TARGET))
    min_cost = min(
        sum(g[p[i]][p[i + 1]]["weight"] for i in range(len(p) - 1)) for p in all_paths
    )
    assert ucs_cost == min_cost, (
        f"UCS finds true minimum cost path (got {ucs_cost}, true min {min_cost})"
    )


def test_astar_matches_ucs_optimality():
    g = build_network()
    _, ucs_cost, _ = ucs_search(g, ATTACKER_START, CRITICAL_TARGET)
    _, astar_cost, _ = astar_search(g, ATTACKER_START, CRITICAL_TARGET)
    assert astar_cost == ucs_cost, (
        f"A* finds equally optimal cost as UCS ({astar_cost} == {ucs_cost})"
    )


def test_full_simulation_runs():
    result = run_full_simulation()
    assert result["attacker_decision"]["path"][0] == ATTACKER_START, (
        "Simulation: attacker path starts correctly"
    )
    assert len(result["selected_honeypots"]) > 0, "Simulation: at least one honeypot selected"
    assert CRITICAL_TARGET not in result["selected_honeypots"], (
        "Simulation: honeypot never placed on Database"
    )
    assert isinstance(result["intercepted"], bool), "Simulation: interception result is boolean"
    assert len(result["explanations"]) > 0, "Simulation: explanations generated"
