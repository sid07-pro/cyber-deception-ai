"""
test_search_edge_cases.py
Behaviour of the four original search algorithms on small hand-built graphs:
unreachable targets, cycles, competing routes, and invalid inputs.
"""

import random

import networkx as nx
import pytest

from ai.astar import astar_search
from ai.bfs import bfs_search
from ai.dfs import dfs_search
from ai.ucs import ucs_search

ALGORITHMS = [
    pytest.param(bfs_search, id="BFS"),
    pytest.param(dfs_search, id="DFS"),
    pytest.param(ucs_search, id="UCS"),
    pytest.param(astar_search, id="A*"),
]
OPTIMAL = [pytest.param(ucs_search, id="UCS"), pytest.param(astar_search, id="A*")]


def _graph(edges, extra_nodes=()):
    g = nx.Graph()
    g.add_nodes_from(extra_nodes)
    for u, v, w in edges:
        g.add_edge(u, v, weight=w)
    return g


def _is_valid_path(g, path, start, goal):
    return (
        path[0] == start
        and path[-1] == goal
        and len(path) == len(set(path))
        and all(g.has_edge(a, b) for a, b in zip(path, path[1:]))
    )


# Two routes from S to G: a short-but-expensive one (2 hops, cost 10) and a
# long-but-cheap one (3 hops, cost 3). BFS should prefer hops, UCS/A* cost.
TWO_ROUTES = _graph([("S", "X", 5), ("X", "G", 5), ("S", "A", 1), ("A", "B", 1), ("B", "G", 1)])


@pytest.mark.parametrize("search", ALGORITHMS)
def test_unreachable_target_returns_empty_path(search):
    g = _graph([("S", "A", 1), ("B", "G", 1)])
    path, cost, explored = search(g, "S", "G")
    assert path == []
    assert cost == 0
    assert explored == 2  # S and A: the whole connected component


@pytest.mark.parametrize("search", ALGORITHMS)
def test_cycles_terminate_with_a_simple_path(search):
    g = _graph([("S", "A", 1), ("A", "B", 1), ("B", "S", 1), ("B", "C", 1), ("C", "A", 1), ("C", "G", 1)])
    path, _, explored = search(g, "S", "G")
    assert _is_valid_path(g, path, "S", "G")
    assert explored <= g.number_of_nodes()


@pytest.mark.parametrize("search", ALGORITHMS)
def test_start_equal_to_goal(search):
    g = _graph([("S", "A", 3)])
    assert search(g, "S", "S") == (["S"], 0, 1)


@pytest.mark.parametrize("search", ALGORITHMS)
@pytest.mark.parametrize("start, goal", [("Nope", "G"), ("S", "Nope")])
def test_unknown_nodes_return_empty_path_instead_of_raising(search, start, goal):
    path, cost, explored = search(TWO_ROUTES, start, goal)
    assert (path, cost, explored) == ([], 0, 0)


@pytest.mark.parametrize("search", ALGORITHMS)
def test_isolated_nodes_without_any_edges(search):
    g = _graph([], extra_nodes=["S", "G"])
    assert search(g, "S", "G")[0] == []


def test_bfs_minimises_hops_not_cost():
    path, cost, _ = bfs_search(TWO_ROUTES, "S", "G")
    assert path == ["S", "X", "G"]
    assert cost == 10


@pytest.mark.parametrize("search", OPTIMAL)
def test_cost_aware_search_takes_the_cheaper_longer_route(search):
    path, cost, _ = search(TWO_ROUTES, "S", "G")
    assert path == ["S", "A", "B", "G"]
    assert cost == 3


def test_dfs_finds_a_valid_but_not_necessarily_optimal_route():
    path, cost, _ = dfs_search(TWO_ROUTES, "S", "G")
    assert _is_valid_path(TWO_ROUTES, path, "S", "G")
    assert cost >= 3


def test_astar_expands_no_more_nodes_than_ucs_on_a_corridor():
    # A long corridor with a dead-end branch near the start: the admissible
    # hop heuristic should keep A* from wandering further than UCS.
    edges = [(f"n{i}", f"n{i + 1}", 1) for i in range(6)] + [("n0", "dead1", 1), ("dead1", "dead2", 1)]
    g = _graph(edges)
    _, ucs_cost, ucs_explored = ucs_search(g, "n0", "n6")
    _, astar_cost, astar_explored = astar_search(g, "n0", "n6")
    assert astar_cost == ucs_cost == 6
    assert astar_explored <= ucs_explored


@pytest.mark.parametrize("search", OPTIMAL)
def test_optimal_search_matches_networkx_on_random_graphs(search):
    for seed in range(5):
        g = nx.connected_watts_strogatz_graph(12, 4, 0.3, seed=seed)
        rng = random.Random(seed)
        for u, v in g.edges:
            g[u][v]["weight"] = rng.randint(1, 9)
        _, cost, _ = search(g, 0, 11)
        assert cost == nx.shortest_path_length(g, 0, 11, weight="weight")
