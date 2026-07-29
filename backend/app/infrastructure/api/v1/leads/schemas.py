from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.application.ports.file_storage_provider import ExportFormat


class LeadResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    address: str | None
    phone: str | None
    website: str | None
    email: str | None
    whatsapp: str | None
    category: str | None
    rating: float | None
    reviews_count: int | None
    lead_score: int | None
    lead_score_summary: str | None
    status: str
    owner_user_id: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class ImportLeadsBody(BaseModel):
    keyword: str
    location: str
    max_results: int = 100


class ImportLeadsResponse(BaseModel):
    imported_count: int
    skipped_duplicates: int
    leads: list[LeadResponse]


class UpdateLeadStatusBody(BaseModel):
    status: str


class AssignLeadBody(BaseModel):
    user_id: str


class ExportLeadsBody(BaseModel):
    lead_ids: list[str]
    format: ExportFormat


class ExportLeadsResponse(BaseModel):
    file_url: str
    total_exported: int
