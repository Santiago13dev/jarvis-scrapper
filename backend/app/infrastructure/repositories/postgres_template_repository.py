"""
Adapter: PostgresTemplateRepository.
"""
from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mappers.template_mapper import DemoPageTemplateMapper, MessageTemplateMapper
from app.application.ports.repositories.template_repository import TemplateRepository
from app.domain.entities.template import DemoPageTemplate, MessageTemplate
from app.infrastructure.database.models.template import DemoPageTemplateModel, MessageTemplateModel


class PostgresTemplateRepository(TemplateRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_message_templates(self, workspace_id: str) -> Sequence[MessageTemplate]:
        stmt = select(MessageTemplateModel).where(MessageTemplateModel.workspace_id == workspace_id)
        result = await self._session.execute(stmt)
        return [MessageTemplateMapper.to_entity(m) for m in result.scalars().all()]

    async def create_message_template(
        self, workspace_id: str, template: MessageTemplate
    ) -> MessageTemplate:
        model = MessageTemplateMapper.to_model(template)
        self._session.add(model)
        await self._session.flush()
        return MessageTemplateMapper.to_entity(model)

    async def list_demo_page_templates(
        self, business_category: str | None = None
    ) -> Sequence[DemoPageTemplate]:
        stmt = select(DemoPageTemplateModel)
        if business_category:
            stmt = stmt.where(DemoPageTemplateModel.business_category == business_category)
        result = await self._session.execute(stmt)
        return [DemoPageTemplateMapper.to_entity(m) for m in result.scalars().all()]

    async def get_demo_page_template(self, template_id: str) -> DemoPageTemplate | None:
        model = await self._session.get(DemoPageTemplateModel, template_id)
        return DemoPageTemplateMapper.to_entity(model) if model else None

    async def delete_message_template(self, workspace_id: str, template_id: str) -> bool:
        stmt = select(MessageTemplateModel).where(
            MessageTemplateModel.id == template_id,
            MessageTemplateModel.workspace_id == workspace_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        return True

    async def get_message_template(self, workspace_id: str, template_id: str) -> MessageTemplate | None:
        stmt = select(MessageTemplateModel).where(
            MessageTemplateModel.id == template_id,
            MessageTemplateModel.workspace_id == workspace_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return MessageTemplateMapper.to_entity(model) if model else None

    async def update_message_template(
        self, workspace_id: str, template: MessageTemplate
    ) -> MessageTemplate:
        model = await self._session.get(MessageTemplateModel, template.id)
        if model is None or model.workspace_id != workspace_id:
            raise ValueError(f"Template {template.id} no encontrado en workspace {workspace_id}")
        model.name = template.name
        model.content = template.content
        model.variables = template.variables
        await self._session.flush()
        return MessageTemplateMapper.to_entity(model)
