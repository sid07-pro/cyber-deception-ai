"""
minimax.py
Adversarial search: full Minimax over any object implementing `ai.game.Game`.

No pruning here — this is the reference result that `ai.alpha_beta` must match.
Ties are broken by action order, so the outcome is deterministic.
"""

from typing import Any

from ai.game import Game, SearchStats


def minimax(game: Game, state: Any, depth: int) -> tuple[Any, float, SearchStats]:
    """
    Returns (best_action, value, stats) for the player to move in `state`.

    `depth` is counted in plies; at depth 0 the state is scored heuristically.
    best_action is None when the state is terminal or no actions are legal.
    """
    stats = SearchStats()
    value, action = _search(game, state, depth, stats)
    return action, value, stats


def _search(game: Game, state: Any, depth: int, stats: SearchStats) -> tuple[float, Any]:
    stats.nodes_visited += 1

    if depth <= 0 or game.is_terminal(state):
        return game.utility(state), None

    actions = game.actions(state)
    if not actions:
        return game.utility(state), None

    maximizing = game.is_max(state)
    best_value = float("-inf") if maximizing else float("inf")
    best_action = None

    for action in actions:
        child_value, _ = _search(game, game.result(state, action), depth - 1, stats)
        # Strict comparison keeps the first action of equal value, matching Alpha-Beta.
        if (maximizing and child_value > best_value) or (
            not maximizing and child_value < best_value
        ):
            best_value = child_value
            best_action = action

    return best_value, best_action
