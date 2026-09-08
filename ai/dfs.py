"""
dfs.py
Manual Depth First Search implementation for attacker path planning.
Explores as far as possible along each branch before backtracking.
"""


def dfs_search(graph, start, goal):
    """
    Returns (path, cost, nodes_explored).
    Iterative DFS using an explicit stack to avoid recursion limits.
    """
    stack = [(start, [start])]
    visited = set()
    nodes_explored = 0

    while stack:
        current, path_so_far = stack.pop()

        if current in visited:
            continue
        visited.add(current)
        nodes_explored += 1

        if current == goal:
            return path_so_far, _path_cost(graph, path_so_far), nodes_explored

        # Push neighbors (reversed so exploration order feels natural)
        neighbors = list(graph.neighbors(current))
        for neighbor in reversed(neighbors):
            if neighbor not in visited:
                stack.append((neighbor, path_so_far + [neighbor]))

    return [], 0, nodes_explored


def _path_cost(graph, path):
    total = 0
    for i in range(len(path) - 1):
        total += graph[path[i]][path[i + 1]]["weight"]
    return total
