"""
Eventos de dominio concretos. Se publican desde los casos de uso vía EventBus,
sin que estos sepan quién los consume.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.events.base_event import DomainEvent


@dataclass(frozen=True)
class LeadImportedEvent(DomainEvent):
    lead_id: str = ""
    source: str = "google_maps"


@dataclass(frozen=True)
class LeadAnalyzedEvent(DomainEvent):
    lead_id: str = ""
    lead_score: int = 0


@dataclass(frozen=True)
class CampaignCreatedEvent(DomainEvent):
    campaign_id: str = ""


@dataclass(frozen=True)
class CampaignStatusChangedEvent(DomainEvent):
    campaign_id: str = ""
    new_status: str = ""


@dataclass(frozen=True)
class MessageSentEvent(DomainEvent):
    conversation_id: str = ""
    message_id: str = ""


@dataclass(frozen=True)
class ConversationUpdatedEvent(DomainEvent):
    conversation_id: str = ""


@dataclass(frozen=True)
class ConversationTransferredToHumanEvent(DomainEvent):
    conversation_id: str = ""
    reason: str = ""
