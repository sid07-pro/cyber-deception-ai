"""
ai.py
Request/response schemas for the advanced AI analysis endpoint.
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.simulation import SearchAlgorithm


class AITechnique(str, Enum):
    """Advanced techniques exposed by the AI registry."""

    MINIMAX = "minimax"
    ALPHA_BETA = "alpha_beta"
    BAYESIAN = "bayesian"
    HILL_CLIMBING = "hill_climbing"
    GENETIC_ALGORITHM = "genetic_algorithm"


class AIAnalyzeRequest(BaseModel):
    """Scenario and parameters for one advanced-AI run."""

    technique: AITechnique = Field(description="Which advanced technique to run.")
    start_node: str | None = Field(default=None, description="Attacker entry point.")
    target_node: str | None = Field(default=None, description="Asset the defender protects.")
    honeypot_budget: int = Field(default=2, ge=0, le=5, description="Honeypots available.")
    depth: int = Field(default=4, ge=1, le=8, description="Search depth for game search.")
    seed: int = Field(default=0, ge=0, description="Random seed for the optimizers.")
    algorithm: SearchAlgorithm = Field(
        default=SearchAlgorithm.ASTAR,
        description="Search strategy used when a technique needs a predicted path.",
    )


class AIAnalyzeResponse(BaseModel):
    """Structured outcome of one advanced-AI run."""

    technique: AITechnique
    start_node: str
    target_node: str
    recommendation: str = Field(description="Selected action or placement, in plain text.")
    score: float = Field(description="Utility, fitness, or posterior probability.")
    probability: float | None = Field(
        default=None, description="Route-level probability, when the technique reports one."
    )
    honeypots: list[str] = Field(
        default_factory=list, description="Recommended honeypot locations, when applicable."
    )
    metrics: dict[str, Any] = Field(
        default_factory=dict, description="Technique-specific intermediate values."
    )
    explanation: list[str] = Field(description="Concise account of how the result was reached.")
