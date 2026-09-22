from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class FollowUpResponse(BaseModel):
    id: str
    workspace_id: str
    lead_id: str
    status: str
    next_follow_up_at: datetime
    created_at: datetime
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancel_reason: str | None


class CreateFollowUpRequest(BaseModel):
    next_follow_up_at: datetime


class RescheduleFollowUpRequest(BaseModel):
    next_follow_up_at: datetime


class CancelFollowUpRequest(BaseModel):
    reason: str = Field(default="cancelled_by_user", max_length=255)
