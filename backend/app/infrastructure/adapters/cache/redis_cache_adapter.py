"""
Adapter: RedisCacheAdapter — implementa CacheProvider usando redis-py (async).
"""
from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis

from app.application.ports.cache_provider import CacheProvider
from app.infrastructure.config.config import get_settings


class RedisCacheAdapter(CacheProvider):
    def __init__(self, client: Redis | None = None) -> None:
        settings = get_settings()
        self._client = client or Redis.from_url(settings.redis_url, decode_responses=True)

    async def get(self, key: str) -> Any | None:
        raw = await self._client.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw

    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        serialized = value if isinstance(value, str) else json.dumps(value)
        await self._client.set(key, serialized, ex=ttl_seconds)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def increment(self, key: str, amount: int = 1) -> int:
        return await self._client.incrby(key, amount)
