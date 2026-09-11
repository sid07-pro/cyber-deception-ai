"""
optimizer.py
Defender Agent: decides where to place honeypots using a transparent,
explainable scoring function (a form of local search / greedy
optimization over candidate nodes).

Deception Score(node) =
    (Attack Path Frequency + Target Proximity + Node Connectivity)
    ------------------------------------------------------------
                        Deployment Cost

Higher score => better honeypot location.
"""

import networkx as nx

# Simulated fixed deployment cost per node type (educational simplification)
DEPLOYMENT_COST = {
    "Web Server": 2,
    "Application Server": 3,
    "Employee PC": 1,
    "Admin PC": 2,
    "File Server": 2,
}


def _attack_path_frequency(node, candidate_paths):
    """How often this node appears across all algorithms' attacker paths."""
    return sum(1 for path in candidate_paths if node in path)


def _target_proximity(graph, node, target):
    """Closer to the target => higher proximity score (inverse of hop distance)."""
    try:
        dist = nx.shortest_path_length(graph, node, target)
    except nx.NetworkXNoPath:
        return 0
    return 1 / (dist + 1)  # +1 avoids division by zero, keeps score bounded


def _node_connectivity(graph, node):
    """Degree centrality proxy: more connections = more attractive to intercept traffic."""
    return graph.degree(node)


def score_candidates(graph, candidate_paths, candidates, target, top_n=2):
    """
    Computes the Deception Score for every honeypot candidate node.

    candidates: iterable of nodes eligible for honeypot placement.
    target:     the critical asset node used for proximity scoring.

    Returns a sorted list of dicts (highest score first) and the top_n selections.
    """
    scored = []
    for node in candidates:
        freq = _attack_path_frequency(node, candidate_paths)
        proximity = round(_target_proximity(graph, node, target), 3)
        connectivity = _node_connectivity(graph, node)
        cost = DEPLOYMENT_COST.get(node, 1)

        raw_score = (freq + proximity + connectivity) / cost
        scored.append({
            "node": node,
            "attack_path_frequency": freq,
            "target_proximity": proximity,
            "node_connectivity": connectivity,
            "deployment_cost": cost,
            "deception_score": round(raw_score, 3),
        })

    scored.sort(key=lambda x: x["deception_score"], reverse=True)
    selected = [item["node"] for item in scored[:top_n]]
    return scored, selected
