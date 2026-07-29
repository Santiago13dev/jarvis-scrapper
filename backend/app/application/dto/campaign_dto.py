"""
DTOs para casos de uso de Campaigns.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class CreateCampaignRequest:
    workspace_id: str
    name: str
    message_template_id: str
    lead_ids: list[str] = field(default_factory=list)
    scheduled_at: datetime | None = None


@dataclass(frozen=True)
class ChangeCampaignStatusRequest:
    workspace_id: str
    campaign_id: str
    action: str  # "pause" | "resume" | "finish"
