"""
scenario.py
ORM models for the entities worth keeping across restarts: saved network
scenarios (with their nodes and edges) and completed experiments.

Live step-by-step sessions stay in memory — they are short-lived and would add
write churn with no benefit.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Scenario(Base):
    """A saved network topology plus its attacker start and protected asset."""

    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    attacker_start: Mapped[str] = mapped_column(String(120))
    critical_target: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    nodes: Mapped[list["ScenarioNode"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan", order_by="ScenarioNode.id"
    )
    edges: Mapped[list["ScenarioEdge"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan", order_by="ScenarioEdge.id"
    )
    experiments: Mapped[list["ExperimentRecord"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan"
    )


class ScenarioNode(Base):
    """One host in a saved scenario."""

    __tablename__ = "scenario_nodes"
    __table_args__ = (UniqueConstraint("scenario_id", "node_id", name="uq_scenario_node"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    scenario_id: Mapped[int] = mapped_column(
        ForeignKey("scenarios.id", ondelete="CASCADE"), index=True
    )
    node_id: Mapped[str] = mapped_column(String(120))
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(60))
    criticality: Mapped[str] = mapped_column(String(20))
    node_metadata: Mapped[dict] = mapped_column(JSON, default=dict)

    scenario: Mapped[Scenario] = relationship(back_populates="nodes")


class ScenarioEdge(Base):
    """One link between two hosts in a saved scenario."""

    __tablename__ = "scenario_edges"

    id: Mapped[int] = mapped_column(primary_key=True)
    scenario_id: Mapped[int] = mapped_column(
        ForeignKey("scenarios.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[str] = mapped_column(String(120))
    target: Mapped[str] = mapped_column(String(120))
    weight: Mapped[int] = mapped_column(Integer)

    scenario: Mapped[Scenario] = relationship(back_populates="edges")


class ExperimentRecord(Base):
    """
    A completed experiment: its configuration, aggregate metrics, and the
    strategy comparison. Individual run rows are not stored — the aggregates
    and a capped summary list are what the UI and the report need.
    """

    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    scenario_id: Mapped[int | None] = mapped_column(
        ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=True, index=True
    )
    algorithm: Mapped[str] = mapped_column(String(20))
    strategy: Mapped[str] = mapped_column(String(40))
    honeypot_budget: Mapped[int] = mapped_column(Integer)
    runs: Mapped[int] = mapped_column(Integer)
    seed: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    configuration: Mapped[dict] = mapped_column(JSON, default=dict)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    strategy_comparison: Mapped[list] = mapped_column(JSON, default=list)
    run_summaries: Mapped[list] = mapped_column(JSON, default=list)
    explanation: Mapped[list] = mapped_column(JSON, default=list)

    scenario: Mapped[Scenario | None] = relationship(back_populates="experiments")
