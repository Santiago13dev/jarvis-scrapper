from __future__ import annotations

from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    total_leads: int
    total_campaigns_active: int
    total_conversations_open: int
    total_conversations_transferred_to_human: int
    average_lead_score: float
    messages_sent_last_30_days: int
    conversion_rate: float
