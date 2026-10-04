from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class LeadSearchHistoryEntry:
    id: str
    workspace_id: str
    query: str
    filters: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)


class LeadSearchHistoryService:
    """Gestión de historial de búsquedas por workspace.

    Mantiene un registro simple y deduplicado de consultas recientes para evitar repetir
    búsquedas iguales dentro del mismo workspace. La implementación sirve tanto para tests
    como para un store mínimo cuando no hay persistencia aún.
    """

    _memory: dict[str, list[dict[str, Any]]] = {}

    @classmethod
    def normalize_query(cls, query: str | None) -> str:
        if query is None:
            return ""
        cleaned = re.sub(r"\s+", " ", query.strip())
        return cleaned

    @classmethod
    def record_search(
        cls,
        workspace_id: str,
        query: str | None,
        filters: dict[str, Any] | None = None,
    ) -> LeadSearchHistoryEntry:
        normalized = cls.normalize_query(query)
        if not normalized:
            raise ValueError("La consulta no puede estar vacía")

        bucket = cls._memory.setdefault(str(workspace_id), [])
        now = datetime.now(timezone.utc).isoformat()
        for item in bucket:
            if item["query"] == normalized:
                item["filters"] = filters or {}
                item["updated_at"] = now
                return LeadSearchHistoryEntry(**item)

        record = LeadSearchHistoryEntry(
            id=str(uuid.uuid4()),
            workspace_id=str(workspace_id),
            query=normalized,
            filters=filters or {},
            created_at=now,
            updated_at=now,
        )
        bucket.insert(0, record.__dict__)
        cls._memory[str(workspace_id)] = bucket[:10]
        return record

    @classmethod
    def list_recent(cls, workspace_id: str, limit: int = 5) -> list[dict[str, Any]]:
        bucket = cls._memory.get(str(workspace_id), [])
        ordered = sorted(bucket, key=lambda item: item["updated_at"], reverse=True)
        return ordered[:limit]
