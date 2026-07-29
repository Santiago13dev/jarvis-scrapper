"""
Mapper: MessageTemplate / DemoPageTemplate ↔ sus modelos SQLAlchemy.
"""
from __future__ import annotations

from app.domain.entities.template import DemoPageTemplate, MessageTemplate
from app.infrastructure.database.models.template import DemoPageTemplateModel, MessageTemplateModel


class MessageTemplateMapper:
    @staticmethod
    def to_entity(model: MessageTemplateModel) -> MessageTemplate:
        return MessageTemplate(
            id=model.id,
            workspace_id=model.workspace_id,
            name=model.name,
            content=model.content,
            variables=model.variables.split(",") if model.variables else [],
            created_at=model.created_at,
        )

    @staticmethod
    def to_model(entity: MessageTemplate) -> MessageTemplateModel:
        return MessageTemplateModel(
            id=entity.id,
            workspace_id=entity.workspace_id,
            name=entity.name,
            content=entity.content,
            variables=",".join(entity.variables) if entity.variables else None,
            created_at=entity.created_at,
        )


class DemoPageTemplateMapper:
    @staticmethod
    def to_entity(model: DemoPageTemplateModel) -> DemoPageTemplate:
        return DemoPageTemplate(
            id=model.id,
            business_category=model.business_category,
            name=model.name,
            html_template_path=model.html_template_path,
            preview_image_url=model.preview_image_url,
        )

    @staticmethod
    def to_model(entity: DemoPageTemplate) -> DemoPageTemplateModel:
        return DemoPageTemplateModel(
            id=entity.id,
            business_category=entity.business_category,
            name=entity.name,
            html_template_path=entity.html_template_path,
            preview_image_url=entity.preview_image_url,
        )
