"""
Entidad: Lead (empresa prospectada) + su ficha de CRM.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from app.domain.value_objects.lead_score import LeadScore


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    REPLIED = "replied"
    QUALIFIED = "qualified"
    DEMO_SENT = "demo_sent"
    WON = "won"
    LOST = "lost"


@dataclass
class LeadNote:
    author_user_id: str
    content: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class LeadTask:
    title: str
    due_date: datetime | None = None
    assigned_to_user_id: str | None = None
    is_done: bool = False
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class Lead:
    workspace_id: str
    name: str
    raw_source_id: str | None  # place_id u otro id de origen, para deduplicación
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    email: str | None = None
    whatsapp: str | None = None
    instagram: str | None = None
    facebook: str | None = None
    category: str | None = None
    rating: float | None = None
    reviews_count: int | None = None
    photos_count: int | None = None
    latitude: float | None = None
    longitude: float | None = None

    score: LeadScore | None = None
    status: LeadStatus = LeadStatus.NEW
    owner_user_id: str | None = None  # responsable
    tags: list[str] = field(default_factory=list)
    notes: list[LeadNote] = field(default_factory=list)
    tasks: list[LeadTask] = field(default_factory=list)

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def apply_ai_score(self, score: LeadScore) -> None:
        self.score = score
        self.updated_at = datetime.now(timezone.utc)

    def assign_to(self, user_id: str) -> None:
        self.owner_user_id = user_id
        self.updated_at = datetime.now(timezone.utc)

    def add_tag(self, tag: str) -> None:
        if tag not in self.tags:
            self.tags.append(tag)

    def change_status(self, new_status: LeadStatus) -> None:
        self.status = new_status
        self.updated_at = datetime.now(timezone.utc)

    @property
    def has_digital_presence(self) -> bool:
        return any([self.website, self.email, self.whatsapp, self.instagram, self.facebook])
