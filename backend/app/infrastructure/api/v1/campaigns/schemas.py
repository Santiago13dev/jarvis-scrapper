from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class CampaignResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    message_template_id: str
    lead_ids: list[str]
    status: str
    scheduled_at: datetime | None
    created_at: datetime


class CreateCampaignBody(BaseModel):
    name: str
    message_template_id: str
    lead_ids: list[str] = []
    scheduled_at: datetime | None = None


class ChangeCampaignStatusBody(BaseModel):
    action: str  # "pause" | "resume" | "finish"
