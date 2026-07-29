"""
Clase base para eventos de dominio. Python puro, sin dependencias de infraestructura.

Ejemplos de eventos concretos a definir aquí más adelante:
    LeadImportedEvent, LeadAnalyzedEvent, CampaignCreatedEvent,
    MessageSentEvent, ConversationUpdatedEvent, ConversationTransferredEvent
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass(frozen=True)
class DomainEvent:
    workspace_id: str
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def event_type(self) -> str:
        return self.__class__.__name__
