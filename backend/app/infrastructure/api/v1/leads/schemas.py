from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.application.dto.lead_scoring_dto import (
    BulkRecalculateLeadScoreRequest,
    BulkRecalculateLeadScoreResponse,
    LeadScoringReason,
    LeadScoringResult,
    RecalculateLeadScoreRequest,
)
from app.application.ports.file_storage_provider import ExportFormat
from app.application.dto.website_audit_dto import WebsiteAuditResult


class LeadResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    address: str | None
    phone: str | None
    website: str | None
    email: str | None
    whatsapp: str | None
    instagram: str | None = None
    facebook: str | None = None
    listing_url: str | None = None
    category: str | None
    country: str | None
    rating: float | None
    reviews_count: int | None
    lead_score: int | None
    lead_score_summary: str | None
    score_level: str | None
    score_reasons: list[LeadScoringReason]
    score_niche: str | None
    score_calculated_at: datetime | None
    status: str
    owner_user_id: str | None
    last_contacted_at: datetime | None = None
    contact_attempts: int = 0
    latitude: float | None = None
    longitude: float | None = None
    do_not_contact: bool
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class ImportLeadsBody(BaseModel):
    keyword: str
    location: str
    max_results: int = 100
    depth: int = 1
    extract_emails: bool = True
    country: str = "CO"


class ImportLeadsResponse(BaseModel):
    imported_count: int
    skipped_duplicates: int
    skipped_closed: int = 0
    leads: list[LeadResponse]


class LeadSearchHistoryBody(BaseModel):
    query: str
    filters: dict[str, object] | None = None


class LeadSearchHistoryResponse(BaseModel):
    id: str
    workspace_id: str
    query: str
    filters: dict[str, object] | None = None
    created_at: datetime
    updated_at: datetime


class UpdateLeadStatusBody(BaseModel):
    status: str
    next_follow_up_at: datetime | None = None
    do_not_contact: bool | None = None


class AssignLeadBody(BaseModel):
    user_id: str


class ExportLeadsBody(BaseModel):
    lead_ids: list[str]
    format: ExportFormat


class ExportLeadsResponse(BaseModel):
    file_url: str
    total_exported: int


class RecalculateLeadScoreBody(RecalculateLeadScoreRequest):
    pass


class LeadScoringResponse(LeadScoringResult):
    pass


class BulkRecalculateLeadScoreBody(BulkRecalculateLeadScoreRequest):
    pass


class BulkRecalculateLeadScoreResult(BulkRecalculateLeadScoreResponse):
    pass


class WebsiteAuditBody(BaseModel):
    url: str | None = None


class WebsiteAuditResponse(WebsiteAuditResult):
    pass
