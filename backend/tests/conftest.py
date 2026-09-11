"""
conftest.py
Test fixtures.

Persistence tests run against a temporary SQLite file, so nothing depends on a
running PostgreSQL server. The FastAPI dependency is overridden to use that
session, which exercises the same service and route code as production.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base, get_db
from app.main import app
from app.models import scenario as _scenario  # noqa: F401 - registers the tables


@pytest.fixture
def db_session(tmp_path):
    """A clean SQLite-backed session for one test."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)

    session = factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def db_client(db_session):
    """A TestClient whose database dependency uses the temporary SQLite session."""

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
