"""
Router: /api/v1/workspaces/{workspace_id}/templates

Incluye tanto MessageTemplate (por workspace) como DemoPageTemplate (biblioteca global,
por eso su listado no depende de workspace_id salvo para exigir que el usuario esté
autenticado y tenga acceso a algún workspace).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.repositories.template_repository import TemplateRepository
from app.domain.entities.template import DemoPageTemplate, MessageTemplate
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import get_template_repository, require_workspace_access

from .schemas import (
    CreateMessageTemplateBody,
    DemoPageTemplateResponse,
    MessageTemplateResponse,
)

router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]


def _message_template_to_response(t: MessageTemplate) -> MessageTemplateResponse:
    return MessageTemplateResponse(
        id=t.id, workspace_id=t.workspace_id, name=t.name, content=t.content, variables=t.variables
    )


def _demo_page_to_response(t: DemoPageTemplate) -> DemoPageTemplateResponse:
    return DemoPageTemplateResponse(
        id=t.id, business_category=t.business_category, name=t.name,
        html_template_path=t.html_template_path, preview_image_url=t.preview_image_url,
    )


@router.get("/messages", response_model=list[MessageTemplateResponse])
async def list_message_templates(
    workspace_id: WorkspaceId,
    template_repository: Annotated[TemplateRepository, Depends(get_template_repository)],
) -> list[MessageTemplateResponse]:
    templates = await template_repository.list_message_templates(workspace_id)
    return [_message_template_to_response(t) for t in templates]


@router.post("/messages", response_model=MessageTemplateResponse, status_code=201)
async def create_message_template(
    workspace_id: WorkspaceId,
    body: CreateMessageTemplateBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    template_repository: Annotated[TemplateRepository, Depends(get_template_repository)],
) -> MessageTemplateResponse:
    template = MessageTemplate(
        workspace_id=workspace_id, name=body.name, content=body.content, variables=body.variables
    )
    created = await template_repository.create_message_template(workspace_id, template)
    await session.commit()
    return _message_template_to_response(created)


@router.delete("/messages/{template_id}", status_code=204, response_class=Response)
async def delete_message_template(
    workspace_id: WorkspaceId,
    template_id: str,
    template_repository: Annotated[TemplateRepository, Depends(get_template_repository)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
):
    deleted = await template_repository.delete_message_template(workspace_id, template_id)
    if not deleted:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Plantilla no encontrada")
    await session.commit()


@router.patch("/messages/{template_id}", response_model=MessageTemplateResponse)
async def update_message_template(
    workspace_id: WorkspaceId,
    template_id: str,
    body: CreateMessageTemplateBody,
    template_repository: Annotated[TemplateRepository, Depends(get_template_repository)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> MessageTemplateResponse:
    existing = await template_repository.get_message_template(workspace_id, template_id)
    if existing is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Plantilla no encontrada")
    existing.name = body.name
    existing.content = body.content
    existing.variables = body.variables
    updated = await template_repository.update_message_template(workspace_id, existing)
    await session.commit()
    return _message_template_to_response(updated)


@router.get("/demo-pages", response_model=list[DemoPageTemplateResponse])
async def list_demo_page_templates(
    workspace_id: WorkspaceId,
    template_repository: Annotated[TemplateRepository, Depends(get_template_repository)],
    business_category: str | None = None,
) -> list[DemoPageTemplateResponse]:
    templates = await template_repository.list_demo_page_templates(business_category)
    return [_demo_page_to_response(t) for t in templates]
