"""
alpha_beta.py
Minimax with alpha-beta pruning, over the same `ai.game.Game` interface.

Returns the same action and value as `ai.minimax` for an equivalent state,
while visiting no more nodes. Pruned branches are counted for comparison.
"""

from typing import Any

from ai.game import Game, SearchStats


def alpha_beta(game: Game, state: Any, depth: int) -> tuple[Any, float, SearchStats]:
    """Returns (best_action, value, stats) — identical to minimax, fewer nodes."""
    stats = SearchStats()
    value, action = _search(game, state, depth, float("-inf"), float("inf"), stats)
    return action, value, stats


def _search(
    game: Game,
    state: Any,
    depth: int,
    alpha: float,
    beta: float,
    stats: SearchStats,
) -> tuple[float, Any]:
    stats.nodes_visited += 1

    if depth <= 0 or game.is_terminal(state):
        return game.utility(state), None

    actions = game.actions(state)
    if not actions:
        return game.utility(state), None

    maximizing = game.is_max(state)
    best_value = float("-inf") if maximizing else float("inf")
    best_action = None

    for index, action in enumerate(actions):
        child_value, _ = _search(
            game, game.result(state, action), depth - 1, alpha, beta, stats
        )

        # Strict comparison keeps the first action of equal value, matching Minimax.
        if (maximizing and child_value > best_value) or (
            not maximizing and child_value < best_value
        ):
            best_value = child_value
            best_action = action

        if maximizing:
            alpha = max(alpha, best_value)
        else:
            beta = min(beta, best_value)

        if beta <= alpha:
            stats.branches_pruned += len(actions) - index - 1
            break

    return best_value, best_action
