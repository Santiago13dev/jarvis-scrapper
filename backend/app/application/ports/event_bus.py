"""
Port: EventBus

No se implementa aún (según feedback: se define el puerto desde ahora para no tener que
tocar los casos de uso cuando se active). Permite desacoplar efectos secundarios del
flujo principal:

    LeadImported → AIAnalyzed → CampaignCreated → MessageSent → ConversationUpdated

Los casos de uso publican eventos de dominio (ver app/domain/events/) sin saber quién
los consume. El adapter inicial puede ser algo tan simple como una implementación
in-memory (para tests) y luego Redis Pub/Sub o un broker real.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Awaitable, Callable

from app.domain.events.base_event import DomainEvent

EventHandler = Callable[[DomainEvent], Awaitable[None]]


class EventBus(ABC):

    @abstractmethod
    async def publish(self, event: DomainEvent) -> None:
        raise NotImplementedError

    @abstractmethod
    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        raise NotImplementedError
