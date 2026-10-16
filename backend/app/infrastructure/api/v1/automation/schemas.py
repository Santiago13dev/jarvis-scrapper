from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.countries import COUNTRIES


class CountryResponse(BaseModel):
    code: str
    name: str
    language: str
    show_prices: bool
    cities: list[str]


class AutopilotRuleBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    country: str = "CO"
    keywords: list[str] = Field(min_length=1, max_length=10)
    locations: list[str] = Field(min_length=1, max_length=10)
    depth: int = Field(default=2, ge=1, le=5)
    frequency_hours: int = Field(default=24, ge=6, le=24 * 30)
    min_score: int = Field(default=70, ge=0, le=100)
    is_active: bool = True

    @field_validator("country")
    @classmethod
    def known_country(cls, value: str) -> str:
        value = value.upper()
        if value not in COUNTRIES:
            raise ValueError(f"País no soportado: {value}")
        return value

    @field_validator("keywords", "locations")
    @classmethod
    def strip_items(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values if value.strip()]
        if not cleaned:
            raise ValueError("Debe incluir al menos un valor")
        return cleaned


class AutopilotRuleUpdateBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    keywords: list[str] | None = None
    locations: list[str] | None = None
    depth: int | None = Field(default=None, ge=1, le=5)
    frequency_hours: int | None = Field(default=None, ge=6, le=24 * 30)
    min_score: int | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class AutopilotRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    country: str
    keywords: list[str]
    locations: list[str]
    depth: int
    frequency_hours: int
    min_score: int
    is_active: bool
    is_running: bool
    last_run_at: datetime | None
    next_run_at: datetime | None
    last_result: dict | None
    total_leads_found: int
    created_at: datetime


class OutreachDraftResponse(BaseModel):
    id: str
    lead_id: str
    lead_name: str
    lead_category: str | None
    lead_country: str | None
    lead_score: int | None
    service: str | None
    kind: str
    to_phone: str
    message: str
    status: str
    scheduled_for: datetime | None
    sent_at: datetime | None
    error: str | None
    created_at: datetime


class DraftIdsBody(BaseModel):
    draft_ids: list[str] = Field(min_length=1, max_length=500)


class DraftLeadsBody(BaseModel):
    lead_ids: list[str] = Field(min_length=1, max_length=500)
    min_score: int = Field(default=0, ge=0, le=100)


class UpdateDraftBody(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class OutreachActionResult(BaseModel):
    affected: int
    first_scheduled_for: datetime | None = None
    last_scheduled_for: datetime | None = None
