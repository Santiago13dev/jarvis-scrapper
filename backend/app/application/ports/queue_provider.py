"""
Port: QueueProvider

Abstrae el motor de colas para jobs asíncronos (envío de campañas, scraping en background,
procesamiento de webhooks). El adapter inicial usará ARQ + Redis (recomendado sobre Celery
por su simplicidad, soporte nativo de asyncio e integración directa con FastAPI). Si en el
futuro se migra a RabbitMQ o SQS, los casos de uso no deben enterarse.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Callable, Coroutine


class QueueProvider(ABC):

    @abstractmethod
    async def enqueue(
        self, job_name: str, payload: dict[str, Any], defer_seconds: int | None = None
    ) -> str:
        """Encola un job y devuelve su job_id."""
        raise NotImplementedError

    @abstractmethod
    async def get_job_status(self, job_id: str) -> str:
        """queued / in_progress / complete / failed / not_found."""
        raise NotImplementedError

    @abstractmethod
    def register_worker(
        self, job_name: str, handler: Callable[[dict[str, Any]], Coroutine[Any, Any, None]]
    ) -> None:
        """Registra el handler que procesará un tipo de job (llamado desde infrastructure/workers)."""
        raise NotImplementedError
