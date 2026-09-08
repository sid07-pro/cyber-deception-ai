"""
test_algorithms.py
Basic sanity tests for BFS, DFS, UCS, A* and the full simulation pipeline.
Run with: python test_algorithms.py
"""

from simulation.network import build_network, ATTACKER_START, CRITICAL_TARGET
from ai.bfs import bfs_search
from ai.dfs import dfs_search
from ai.ucs import ucs_search
from ai.astar import astar_search
from simulation.simulator import run_full_simulation


def check(condition, message):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {message}")
    assert condition, message


def test_all_algorithms_return_valid_paths():
    g = build_network()
    for name, fn in [("BFS", bfs_search), ("DFS", dfs_search), ("UCS", ucs_search), ("A*", astar_search)]:
        path, cost, explored = fn(g, ATTACKER_START, CRITICAL_TARGET)
        check(len(path) > 0, f"{name}: returns non-empty path")
        check(path[0] == ATTACKER_START, f"{name}: path starts at attacker start")
        check(path[-1] == CRITICAL_TARGET, f"{name}: path ends at target")
        check(explored > 0, f"{name}: explored at least one node")

        # verify every consecutive pair is a real edge
        for i in range(len(path) - 1):
            check(g.has_edge(path[i], path[i + 1]), f"{name}: edge {path[i]}->{path[i+1]} exists in graph")


def test_ucs_respects_edge_costs():
    g = build_network()
    ucs_path, ucs_cost, _ = ucs_search(g, ATTACKER_START, CRITICAL_TARGET)

    # brute force: check no simple path has a strictly lower cost
    import networkx as nx
    all_paths = list(nx.all_simple_paths(g, ATTACKER_START, CRITICAL_TARGET))
    min_cost = min(
        sum(g[p[i]][p[i + 1]]["weight"] for i in range(len(p) - 1))
        for p in all_paths
    )
    check(ucs_cost == min_cost, f"UCS finds true minimum cost path (got {ucs_cost}, true min {min_cost})")


def test_astar_matches_ucs_optimality():
    g = build_network()
    _, ucs_cost, _ = ucs_search(g, ATTACKER_START, CRITICAL_TARGET)
    _, astar_cost, _ = astar_search(g, ATTACKER_START, CRITICAL_TARGET)
    check(astar_cost == ucs_cost, f"A* finds equally optimal cost as UCS ({astar_cost} == {ucs_cost})")


def test_full_simulation_runs():
    result = run_full_simulation()
    check(result["attacker_decision"]["path"][0] == ATTACKER_START, "Simulation: attacker path starts correctly")
    check(len(result["selected_honeypots"]) > 0, "Simulation: at least one honeypot selected")
    check(CRITICAL_TARGET not in result["selected_honeypots"], "Simulation: honeypot never placed on Database")
    check(isinstance(result["intercepted"], bool), "Simulation: interception result is boolean")
    check(len(result["explanations"]) > 0, "Simulation: explanations generated")


if __name__ == "__main__":
    test_all_algorithms_return_valid_paths()
    test_ucs_respects_edge_costs()
    test_astar_matches_ucs_optimality()
    test_full_simulation_runs()
    print("\nAll tests passed.")
