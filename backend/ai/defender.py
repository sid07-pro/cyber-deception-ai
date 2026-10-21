"""
defender.py
The Defender Agent: uses the honeypot optimizer to decide placement,
then evaluates whether a given attacker path is intercepted.
"""

from ai.optimizer import score_candidates


def plan_defense(graph, candidate_paths, candidates, target, top_n=2, deployment_costs=None):
    """
    Runs the honeypot placement optimizer.

    candidates: nodes eligible for honeypot placement.
    target:     the critical asset node protected by the defender.

    Returns (scored_table, selected_honeypots).
    """
    return score_candidates(
        graph, candidate_paths, candidates, target, top_n=top_n, deployment_costs=deployment_costs
    )


def evaluate_interception(attacker_path, honeypots):
    """
    Checks whether the attacker's chosen path passes through any honeypot
    before reaching the final target.
    Returns (intercepted: bool, honeypot_hit: str|None, hit_index: int|None)
    """
    for i, node in enumerate(attacker_path):
        if node in honeypots:
            return True, node, i
    return False, None, None
