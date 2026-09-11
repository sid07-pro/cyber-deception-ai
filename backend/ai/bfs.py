"""
bfs.py
Manual Breadth First Search implementation for attacker path planning.
Ignores edge weights; explores level by level; guarantees fewest hops.
"""

from collections import deque


def bfs_search(graph, start, goal):
    """
    Returns (path, cost, nodes_explored).
    path: list of nodes from start to goal (or [] if unreachable)
    cost: sum of edge weights along the returned path
    nodes_explored: number of nodes popped/visited during search
    """
    frontier = deque([start])
    visited = {start}
    parent = {start: None}
    nodes_explored = 0

    while frontier:
        current = frontier.popleft()
        nodes_explored += 1

        if current == goal:
            return _reconstruct_path(parent, goal), _path_cost(graph, parent, goal), nodes_explored

        for neighbor in graph.neighbors(current):
            if neighbor not in visited:
                visited.add(neighbor)
                parent[neighbor] = current
                frontier.append(neighbor)

    return [], 0, nodes_explored


def _reconstruct_path(parent, goal):
    path = []
    node = goal
    while node is not None:
        path.append(node)
        node = parent[node]
    path.reverse()
    return path


def _path_cost(graph, parent, goal):
    path = _reconstruct_path(parent, goal)
    total = 0
    for i in range(len(path) - 1):
        total += graph[path[i]][path[i + 1]]["weight"]
    return total
