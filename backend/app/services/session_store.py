"""
session_store.py
In-memory store for stepped simulation sessions.

Process-local and intentionally non-persistent — sessions disappear on restart.
No database is involved at this stage.
"""

from uuid import uuid4

from app.services.simulation_state import SimulationState


class SessionNotFoundError(KeyError):
    """Raised when a session id does not match a live simulation."""

    def __init__(self, session_id: str) -> None:
        super().__init__(f"No simulation session with id '{session_id}'.")
        self.session_id = session_id


class SessionStore:
    """Dictionary-backed session registry."""

    def __init__(self) -> None:
        self._sessions: dict[str, SimulationState] = {}

    @staticmethod
    def new_id() -> str:
        return uuid4().hex

    def save(self, state: SimulationState) -> SimulationState:
        self._sessions[state.session_id] = state
        return state

    def get(self, session_id: str) -> SimulationState:
        try:
            return self._sessions[session_id]
        except KeyError as exc:
            raise SessionNotFoundError(session_id) from exc

    def clear(self) -> None:
        """Drops every session — used by tests to isolate runs."""
        self._sessions.clear()


# Single process-wide store shared by the API routes.
session_store = SessionStore()
