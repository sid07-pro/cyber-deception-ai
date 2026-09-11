"""
astar.py
Manual A* Search implementation: f(n) = g(n) + h(n)

g(n): actual cumulative cost from start to n (like UCS)
h(n): heuristic estimate of remaining cost from n to goal

Heuristic used: precomputed BFS hop-distance (in unweighted graph) from
each node to the goal, scaled by the minimum edge weight in the graph.
This keeps the heuristic admissible (never overestimates), since no path
can cost less than (hop_count * min_edge_weight).
"""

import heapq
from collections import deque


def _build_heuristic(graph, goal):
    """
    Precompute an admissible heuristic: BFS hop-distance to goal,
    scaled by the graph's minimum edge weight.
    """
    min_weight = min(d["weight"] for _, _, d in graph.edges(data=True))

    hop_dist = {goal: 0}
    queue = deque([goal])
    while queue:
        node = queue.popleft()
        for neighbor in graph.neighbors(node):
            if neighbor not in hop_dist:
                hop_dist[neighbor] = hop_dist[node] + 1
                queue.append(neighbor)

    return {node: hops * min_weight for node, hops in hop_dist.items()}


def astar_search(graph, start, goal):
    """
    Returns (path, cost, nodes_explored).
    """
    heuristic = _build_heuristic(graph, goal)

    counter = 0
    # frontier entries: (f_score, tie_breaker, node, g_score, path)
    frontier = [(heuristic.get(start, 0), counter, start, 0, [start])]
    best_g = {start: 0}
    nodes_explored = 0
    visited = set()

    while frontier:
        f_score, _, current, g_score, path = heapq.heappop(frontier)

        if current in visited:
            continue
        visited.add(current)
        nodes_explored += 1

        if current == goal:
            return path, g_score, nodes_explored

        for neighbor in graph.neighbors(current):
            edge_cost = graph[current][neighbor]["weight"]
            new_g = g_score + edge_cost
            if neighbor not in best_g or new_g < best_g[neighbor]:
                best_g[neighbor] = new_g
                h = heuristic.get(neighbor, 0)
                counter += 1
                heapq.heappush(frontier, (new_g + h, counter, neighbor, new_g, path + [neighbor]))

    return [], 0, nodes_explored
