"""
ai.py
Advanced AI analysis: adversarial search, Bayesian risk, and placement optimizers.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.ai import AIAnalyzeRequest, AIAnalyzeResponse
from app.services import ai_registry
from app.services.ai_registry import UnknownNodeError, UnknownTechniqueError

router = APIRouter(prefix="/ai")


@router.post("/analyze", response_model=AIAnalyzeResponse)
def analyze(request: AIAnalyzeRequest) -> AIAnalyzeResponse:
    """Runs the selected advanced technique over the simulated network."""
    try:
        result = ai_registry.analyze(
            technique=request.technique.value,
            start_node=request.start_node,
            target_node=request.target_node,
            honeypot_budget=request.honeypot_budget,
            depth=request.depth,
            seed=request.seed,
            algorithm=request.algorithm.value,
        )
    except UnknownNodeError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnknownTechniqueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    return AIAnalyzeResponse(**result)
