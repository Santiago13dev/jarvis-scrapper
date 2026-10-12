from __future__ import annotations

from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field


class WebAuditInput(BaseModel):
    website_reachable: bool | None = None
    https_enabled: bool | None = None
    has_title: bool | None = None
    has_meta_description: bool | None = None
    mobile_friendly: bool | None = None
    load_time_ms: int | None = Field(default=None, ge=0)
    audited_at: datetime | None = None


class LeadScoringWeights(BaseModel):
    """Pesos del potencial de venta. Mitad «vale la pena», mitad «necesita ayuda digital»."""

    rating: float = Field(default=15, ge=0)
    reviews: float = Field(default=15, ge=0)
    contact: float = Field(default=20, ge=0)
    website: float = Field(default=25, ge=0)
    https: float = Field(default=5, ge=0)
    reachable: float = Field(default=5, ge=0)
    mobile: float = Field(default=5, ge=0)
    seo: float = Field(default=5, ge=0)
    performance: float = Field(default=5, ge=0)

    def normalized(self) -> dict[str, float]:
        values = self.model_dump()
        total = sum(values.values())
        if total <= 0:
            raise ValueError("Los pesos del scoring deben sumar más de cero")
        return {key: value / total * 100 for key, value in values.items()}


class LeadScoringReason(BaseModel):
    description: str
    points: float


class LeadScoringResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    score: int
    level: str
    reasons: list[LeadScoringReason]
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    niche: str = "default"


class RecalculateLeadScoreRequest(BaseModel):
    niche: str = Field(default="default", min_length=1, max_length=100)
    audit: WebAuditInput | None = None
    weights: LeadScoringWeights | None = None


class BulkRecalculateLeadScoreRequest(BaseModel):
    lead_ids: list[str] = Field(min_length=1)
    niche: str = Field(default="default", min_length=1, max_length=100)


class BulkRecalculateLeadScoreResponse(BaseModel):
    job_id: str
    queued_count: int
