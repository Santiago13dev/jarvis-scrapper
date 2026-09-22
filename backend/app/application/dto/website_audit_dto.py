from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class WebsiteAuditResult(BaseModel):
    url: HttpUrl
    final_url: HttpUrl | None = None
    status_code: int | None = None
    https: bool
    meta_viewport: bool
    title: str | None = None
    meta_description: str | None = None
    phone_links: list[str] = Field(default_factory=list)
    whatsapp_links: list[str] = Field(default_factory=list)
    forms: int = 0
    booking_links: list[str] = Field(default_factory=list)
    chatbot_widgets: list[str] = Field(default_factory=list)
    social_links: list[str] = Field(default_factory=list)
    response_time_ms: int | None = None
    content_bytes: int = 0
    audited_at: datetime


class WebsiteAuditRequest(BaseModel):
    url: HttpUrl
