"""
health.py
Response schema for the health endpoint.
"""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Backend liveness payload."""

    status: str = Field(description="Liveness indicator, 'ok' when the API is serving.")
    service: str = Field(description="Name of the service reporting health.")
    version: str = Field(description="Running application version.")
