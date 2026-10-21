"""
session.py
SQLAlchemy engine, session factory, and table creation.

The database URL comes from the environment (see app.config). PostgreSQL is the
production target; tests point the same code at SQLite, so nothing here may use
PostgreSQL-only types.

Table creation uses `metadata.create_all` rather than a migration tool: this is
an academic project with a small, additive schema, and it keeps setup to one
command. Swapping in Alembic later needs no model changes.
"""

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for every ORM model."""


class DatabaseUnavailableError(RuntimeError):
    """Raised when the database cannot be reached, so the API can answer 503."""


def _engine_options(url: str) -> dict:
    # SQLite (used by the tests) needs a same-thread escape hatch.
    if url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    # Managed PostgreSQL closes idle connections; pre-ping and recycle so a
    # dropped connection is replaced instead of surfacing as a 500.
    return {"pool_pre_ping": True, "pool_recycle": 300, "pool_size": 5, "max_overflow": 5}


settings = get_settings()
DATABASE_URL = settings.sqlalchemy_url
engine = create_engine(DATABASE_URL, future=True, **_engine_options(DATABASE_URL))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_db() -> None:
    """Creates any missing tables. Safe to call repeatedly."""
    # Importing the models registers them on Base.metadata.
    from app.models import scenario as _scenario  # noqa: F401

    Base.metadata.create_all(bind=engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope: commits on success, rolls back on failure."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    session = SessionLocal()
    try:
        yield session
    except SQLAlchemyError:
        session.rollback()
        raise
    finally:
        session.close()
