"""
Adapter: ArqQueueAdapter — implementa QueueProvider usando ARQ + Redis.
"""
from __future__ import annotations

from typing import Any, Callable, Coroutine

from arq import create_pool
from arq.connections import RedisSettings
from arq.jobs import Job

from app.application.ports.queue_provider import QueueProvider
from app.infrastructure.config.config import get_settings

# Registro de handlers que infrastructure/workers/worker_settings.py leerá para
# construir la lista `functions` que ARQ necesita al arrancar el worker.
_REGISTERED_HANDLERS: dict[str, Callable[[dict[str, Any]], Coroutine[Any, Any, None]]] = {}


class ArqQueueAdapter(QueueProvider):
    def __init__(self) -> None:
        settings = get_settings()
        self._redis_settings = RedisSettings.from_dsn(settings.redis_url)
        self._pool = None

    async def _get_pool(self):
        if self._pool is None:
            self._pool = await create_pool(self._redis_settings)
        return self._pool

    async def enqueue(
        self, job_name: str, payload: dict[str, Any], defer_seconds: int | None = None
    ) -> str:
        pool = await self._get_pool()
        job = await pool.enqueue_job(job_name, payload, _defer_by=defer_seconds)
        return job.job_id if job else ""

    async def get_job_status(self, job_id: str) -> str:
        pool = await self._get_pool()
        job = Job(job_id, pool)
        status = await job.status()
        return status.value if status else "not_found"

    def register_worker(
        self, job_name: str, handler: Callable[[dict[str, Any]], Coroutine[Any, Any, None]]
    ) -> None:
        """
        ARQ requiere que las funciones del worker estén declaradas de forma estática al
        arrancar el proceso (ver infrastructure/workers/worker_settings.py), por lo que
        este registro en runtime no alimenta al worker real de ARQ. Sirve para tests /
        un InMemoryQueueAdapter, y como documentación de qué jobs existen.
        """
        _REGISTERED_HANDLERS[job_name] = handler


def get_registered_handlers() -> dict[str, Callable[[dict[str, Any]], Coroutine[Any, Any, None]]]:
    """Útil en tests; en producción los jobs de ARQ se listan explícitamente en WorkerSettings."""
    return _REGISTERED_HANDLERS
