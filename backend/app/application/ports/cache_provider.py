"""
Port: CacheProvider

Abstrae el motor de caché (adapter inicial: Redis). Usado para sesiones de WhatsApp,
resultados de análisis de IA repetidos, rate-limiting, etc.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class CacheProvider(ABC):

    @abstractmethod
    async def get(self, key: str) -> Any | None:
        raise NotImplementedError

    @abstractmethod
    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def increment(self, key: str, amount: int = 1) -> int:
        """Útil para rate-limiting y contadores de uso por workspace."""
        raise NotImplementedError
