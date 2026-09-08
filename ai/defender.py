"""
defender.py
The Defender Agent: uses the honeypot optimizer to decide placement,
then evaluates whether a given attacker path is intercepted.
"""

from ai.optimizer import score_candidates


def plan_defense(graph, candidate_paths, top_n=2):
    """
    Runs the honeypot placement optimizer.
    Returns (scored_table, selected_honeypots).
    """
    return score_candidates(graph, candidate_paths, top_n=top_n)


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
