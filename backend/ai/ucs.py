"""
ucs.py
Manual Uniform Cost Search implementation.
Expands the lowest cumulative-cost node first using a priority queue.
Guarantees the minimum-cost path (unlike BFS, which only minimizes hops).
"""

import heapq


def ucs_search(graph, start, goal):
    """
    Returns (path, cost, nodes_explored).
    """
    if start not in graph or goal not in graph:
        return [], 0, 0

    # Priority queue entries: (cumulative_cost, tie_breaker, node, path)
    counter = 0
    frontier = [(0, counter, start, [start])]
    best_cost = {start: 0}
    nodes_explored = 0
    visited = set()

    while frontier:
        cost, _, current, path = heapq.heappop(frontier)

        if current in visited:
            continue
        visited.add(current)
        nodes_explored += 1

        if current == goal:
            return path, cost, nodes_explored

        for neighbor in graph.neighbors(current):
            edge_cost = graph[current][neighbor]["weight"]
            new_cost = cost + edge_cost
            if neighbor not in best_cost or new_cost < best_cost[neighbor]:
                best_cost[neighbor] = new_cost
                counter += 1
                heapq.heappush(frontier, (new_cost, counter, neighbor, path + [neighbor]))

    return [], 0, nodes_explored
