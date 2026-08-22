"""
Port: TemplateRepository

Cubre tanto plantillas de mensajes (campañas) como plantillas de páginas demo
(biblioteca de páginas web por tipo de negocio).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Sequence

if TYPE_CHECKING:
    from app.domain.entities.template import MessageTemplate, DemoPageTemplate


class TemplateRepository(ABC):

    @abstractmethod
    async def list_message_templates(self, workspace_id: str) -> Sequence["MessageTemplate"]:
        raise NotImplementedError

    @abstractmethod
    async def create_message_template(
        self, workspace_id: str, template: "MessageTemplate"
    ) -> "MessageTemplate":
        raise NotImplementedError

    @abstractmethod
    async def list_demo_page_templates(self, business_category: str | None = None) -> Sequence["DemoPageTemplate"]:
        """Plantillas globales (restaurante, hotel, abogado, taller, clínica, etc)."""
        raise NotImplementedError

    @abstractmethod
    async def delete_message_template(self, workspace_id: str, template_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def get_message_template(self, workspace_id: str, template_id: str) -> "MessageTemplate | None":
        raise NotImplementedError

    @abstractmethod
    async def update_message_template(
        self, workspace_id: str, template: "MessageTemplate"
    ) -> "MessageTemplate":
        raise NotImplementedError

    @abstractmethod
    async def get_demo_page_template(self, template_id: str) -> "DemoPageTemplate | None":
        raise NotImplementedError
