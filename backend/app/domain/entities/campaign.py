"""
Entidad: Campaign.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from app.domain.exceptions.errors import InvalidCampaignTransitionError


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    FINISHED = "finished"


# Transiciones de estado permitidas (regla de negocio del dominio)
_ALLOWED_TRANSITIONS: dict[CampaignStatus, set[CampaignStatus]] = {
    CampaignStatus.DRAFT: {CampaignStatus.SCHEDULED, CampaignStatus.RUNNING},
    CampaignStatus.SCHEDULED: {CampaignStatus.RUNNING, CampaignStatus.DRAFT},
    CampaignStatus.RUNNING: {CampaignStatus.PAUSED, CampaignStatus.FINISHED},
    CampaignStatus.PAUSED: {CampaignStatus.RUNNING, CampaignStatus.FINISHED},
    CampaignStatus.FINISHED: set(),
}


@dataclass
class Campaign:
    workspace_id: str
    name: str
    message_template_id: str
    lead_ids: list[str] = field(default_factory=list)
    status: CampaignStatus = CampaignStatus.DRAFT
    scheduled_at: datetime | None = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def transition_to(self, new_status: CampaignStatus) -> None:
        allowed = _ALLOWED_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise InvalidCampaignTransitionError(self.status.value, new_status.value)
        self.status = new_status

    def pause(self) -> None:
        self.transition_to(CampaignStatus.PAUSED)

    def resume(self) -> None:
        self.transition_to(CampaignStatus.RUNNING)

    def finish(self) -> None:
        self.transition_to(CampaignStatus.FINISHED)

    def add_leads(self, lead_ids: list[str]) -> None:
        for lead_id in lead_ids:
            if lead_id not in self.lead_ids:
                self.lead_ids.append(lead_id)
