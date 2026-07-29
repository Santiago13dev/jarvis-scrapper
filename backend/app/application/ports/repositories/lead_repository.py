"""
Port: LeadRepository

Persistencia de la entidad Lead (empresa prospectada). Las entidades de dominio reales
se definirán en app/domain/entities/lead.py (próximo paso: modelo de datos); aquí se usa
un forward reference para no acoplar el contrato a una implementación aún no escrita.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Sequence

if TYPE_CHECKING:
    from app.domain.entities.lead import Lead


class LeadRepository(ABC):
    """Todo método está implícitamente scoped a workspace_id (aislamiento multi-tenant)."""

    @abstractmethod
    async def get_by_id(self, workspace_id: str, lead_id: str) -> "Lead | None":
        raise NotImplementedError

    @abstractmethod
    async def list_by_workspace(
        self, workspace_id: str, limit: int = 50, offset: int = 0
    ) -> Sequence["Lead"]:
        raise NotImplementedError

    @abstractmethod
    async def find_duplicate(self, workspace_id: str, raw_source_id: str) -> "Lead | None":
        """Detección de duplicados por id de origen (place_id de Google Maps, etc)."""
        raise NotImplementedError

    @abstractmethod
    async def create(self, workspace_id: str, lead: "Lead") -> "Lead":
        raise NotImplementedError

    @abstractmethod
    async def update(self, workspace_id: str, lead: "Lead") -> "Lead":
        raise NotImplementedError

    @abstractmethod
    async def bulk_create(self, workspace_id: str, leads: Sequence["Lead"]) -> Sequence["Lead"]:
        """Usado tras una importación masiva desde ScraperProvider."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, workspace_id: str, lead_id: str) -> None:
        raise NotImplementedError
