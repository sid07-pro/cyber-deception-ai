"""
attacker.py
The Attacker Agent: an intelligent agent whose goal is to reach the
critical target node using the lowest-cost path it can find.

Percept: the network graph state.
Action: choose a search algorithm's output path and move along it.
"""

from ai.bfs import bfs_search
from ai.dfs import dfs_search
from ai.ucs import ucs_search
from ai.astar import astar_search


ALGORITHMS = {
    "BFS": bfs_search,
    "DFS": dfs_search,
    "UCS": ucs_search,
    "A*": astar_search,
}


def run_all_algorithms(graph, start, goal):
    """
    Runs all four search algorithms and returns a dict:
    { algo_name: {"path": [...], "cost": int, "nodes_explored": int} }
    """
    results = {}
    for name, fn in ALGORITHMS.items():
        path, cost, explored = fn(graph, start, goal)
        results[name] = {
            "path": path,
            "cost": cost,
            "nodes_explored": explored,
        }
    return results


def select_attacker_path(graph, start, goal, strategy="A*"):
    """
    The attacker agent's decision procedure: pick a path using the
    specified strategy (default A*, the most 'intelligent' informed
    search available to the agent).
    """
    fn = ALGORITHMS.get(strategy, astar_search)
    path, cost, explored = fn(graph, start, goal)
    return {"path": path, "cost": cost, "nodes_explored": explored, "strategy": strategy}
