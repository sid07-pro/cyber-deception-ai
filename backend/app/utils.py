"""
helpers.py
Small shared utility functions.
"""


def format_path(path):
    """Human-readable path string, e.g. 'Internet -> Web Server -> Database'."""
    return " -> ".join(path) if path else "No path found"


def path_edges(path):
    """Returns list of (u, v) tuples for consecutive nodes in a path."""
    return list(zip(path, path[1:]))
