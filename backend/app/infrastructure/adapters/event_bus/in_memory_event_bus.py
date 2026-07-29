"""
Adapter: InMemoryEventBus — implementación mínima de EventBus para empezar a publicar/
suscribir eventos ya (útil también en tests). Reemplazable por Redis Pub/Sub u otro
broker sin tocar los casos de uso, que sólo conocen el port `EventBus`.
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

from app.application.ports.event_bus import EventBus, EventHandler
from app.domain.events.base_event import DomainEvent

logger = logging.getLogger(__name__)


class InMemoryEventBus(EventBus):
    def __init__(self) -> None:
        self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)

    async def publish(self, event: DomainEvent) -> None:
        handlers = self._subscribers.get(event.event_type, [])
        if not handlers:
            logger.debug("Evento %s publicado sin suscriptores", event.event_type)
            return
        await asyncio.gather(*(handler(event) for handler in handlers))

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        self._subscribers[event_type].append(handler)
