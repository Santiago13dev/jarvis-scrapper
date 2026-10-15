from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    total_leads: int
    total_campaigns_active: int
    total_conversations_open: int
    total_conversations_transferred_to_human: int
    average_lead_score: float
    messages_sent_last_30_days: int
    conversion_rate: float


class TopOpportunity(BaseModel):
    id: str
    name: str
    category: str | None
    country: str | None
    score: int
    service: str | None
    has_whatsapp: bool


class DailyCount(BaseModel):
    date: str
    count: int


class ActivityItem(BaseModel):
    kind: str  # found | drafted | sent | replied
    at: datetime
    count: int
    detail: str | None = None
    country: str | None = None


class PeriodTotals(BaseModel):
    leads: int
    drafted: int
    sent: int
    replies: int


class AutopilotStatus(BaseModel):
    active_rules: int
    running_rules: int
    next_run_at: datetime | None


class DashboardOverviewResponse(BaseModel):
    total_leads: int
    high_opportunity: int
    new_last_7_days: int
    with_whatsapp: int
    pending_approvals: int
    scheduled_messages: int
    sent_today: int
    daily_send_limit: int
    sent_last_30_days: int
    replied: int
    won: int
    pipeline: dict[str, int]
    by_service: dict[str, int]
    by_country: dict[str, int]
    leads_per_day: list[DailyCount]
    top_opportunities: list[TopOpportunity]
    activity: list[ActivityItem]
    last_14_days: PeriodTotals
    autopilot: AutopilotStatus
