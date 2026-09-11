"""
planning.py
Request/response schemas for the defensive planning endpoint.
"""

from enum import Enum

from pydantic import BaseModel, Field


class PlanningMethod(str, Enum):
    """Direction of the state-space search."""

    FORWARD = "forward"
    BACKWARD = "backward"


class GoalType(str, Enum):
    """Defensive goals the planner can pursue."""

    PROTECT_TARGET = "protect_target"
    INTERCEPT_ATTACKER = "intercept_attacker"
    CONTAIN_BREACH = "contain_breach"


class PlanRequest(BaseModel):
    """Scenario and limits for one planning run."""

    method: PlanningMethod = Field(default=PlanningMethod.FORWARD)
    start_node: str | None = Field(default=None, description="Attacker entry point.")
    target_node: str | None = Field(default=None, description="Asset being defended.")
    honeypot_budget: int = Field(default=2, ge=0, le=5)
    max_depth: int = Field(default=4, ge=1, le=8, description="Maximum plan length.")
    goal_type: GoalType = Field(default=GoalType.PROTECT_TARGET)


class PlanAction(BaseModel):
    """One step of a plan."""

    name: str
    parameters: list[str]
    cost: int
    description: str


class PlanResponse(BaseModel):
    """Outcome of one planning run."""

    method: PlanningMethod
    goal_type: GoalType
    goal: str
    start_node: str
    target_node: str
    honeypot_budget: int
    max_depth: int

    success: bool
    actions: list[PlanAction]
    plan_length: int
    plan_cost: int
    explored_states: int
    final_state: list[str] = Field(description="Literals true after the plan runs.")
    reason: str = Field(default="", description="Why no plan was found, when applicable.")
    explanation: list[str]
