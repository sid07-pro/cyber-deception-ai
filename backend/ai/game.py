"""
game.py
Shared game interface used by both Minimax and Alpha-Beta.

Defining it once means the two searches operate on identical state, actions,
terminal tests, and utilities — so they are directly comparable.
"""

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Game(Protocol):
    """Minimal two-player zero-sum game, scored from the maximizing player's view."""

    def actions(self, state: Any) -> list[Any]:
        """Legal actions in this state, in a deterministic order."""

    def result(self, state: Any, action: Any) -> Any:
        """The state reached by taking `action`."""

    def is_terminal(self, state: Any) -> bool:
        """True when no further play is possible."""

    def utility(self, state: Any) -> float:
        """Score of `state` for the maximizing player."""

    def is_max(self, state: Any) -> bool:
        """True when the maximizing player is to move."""


class SearchStats:
    """Counts of work done by a game search, for comparing Minimax and Alpha-Beta."""

    def __init__(self) -> None:
        self.nodes_visited = 0
        self.branches_pruned = 0

    def to_dict(self) -> dict[str, int]:
        return {
            "nodes_visited": self.nodes_visited,
            "branches_pruned": self.branches_pruned,
        }
