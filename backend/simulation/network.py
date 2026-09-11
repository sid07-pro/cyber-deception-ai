"""
network.py
Defines the simulated (fictional) network topology as a graph.
No real hosts, IPs, or systems are represented — everything here is
a synthetic educational scenario.
"""

import networkx as nx

# Node roles used for visualization and logic
NORMAL = "normal"
CRITICAL = "critical"
HONEYPOT_CANDIDATE = "honeypot_candidate"

NODE_ROLES = {
    "Internet": NORMAL,
    "Web Server": HONEYPOT_CANDIDATE,
    "Application Server": HONEYPOT_CANDIDATE,
    "Employee PC": HONEYPOT_CANDIDATE,
    "Admin PC": HONEYPOT_CANDIDATE,
    "File Server": HONEYPOT_CANDIDATE,
    "Database": CRITICAL,
}

# Edges with cost (simulated "difficulty" of moving between nodes)
EDGES = [
    ("Internet", "Web Server", 1),
    ("Web Server", "Application Server", 2),
    ("Web Server", "Employee PC", 2),
    ("Application Server", "Database", 5),
    ("Application Server", "File Server", 3),
    ("Employee PC", "Admin PC", 2),
    ("Admin PC", "Database", 4),
    ("File Server", "Database", 4),
    ("Employee PC", "File Server", 3),
]

ATTACKER_START = "Internet"
CRITICAL_TARGET = "Database"


def build_network() -> nx.Graph:
    """Builds and returns the simulated network graph (NetworkX Graph)."""
    g = nx.Graph()
    for node, role in NODE_ROLES.items():
        g.add_node(node, role=role)
    for u, v, cost in EDGES:
        g.add_edge(u, v, weight=cost)
    return g


def honeypot_candidates(g: nx.Graph):
    """Nodes eligible for honeypot placement (never the critical asset)."""
    return [n for n, d in g.nodes(data=True) if d["role"] == HONEYPOT_CANDIDATE]
