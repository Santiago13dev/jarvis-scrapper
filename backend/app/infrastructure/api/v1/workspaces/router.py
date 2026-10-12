"""
Router: /api/v1/workspaces/{workspace_id}/settings

Ajustes editables desde la pantalla de Configuración: nombre y rubro del workspace,
base de conocimiento del agente IA y el modo de envío de WhatsApp activo (solo lectura,
se define en el .env del servidor).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.repositories.user_repository import UserRepository
from app.infrastructure.config.config import get_settings
from app.infrastructure.database.models.workspace import WorkspaceModel
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import CurrentUser, get_user_repository, require_workspace_access

router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]


class WorkspaceSettingsResponse(BaseModel):
    id: str
    name: str
    business_category: str | None
    knowledge_base: str
    whatsapp_provider: str
    ai_enabled: bool


class UpdateWorkspaceSettingsRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    business_category: str | None = Field(default=None, max_length=100)
    knowledge_base: str | None = Field(default=None, max_length=20000)


def _to_response(workspace: WorkspaceModel) -> WorkspaceSettingsResponse:
    return WorkspaceSettingsResponse(
        id=workspace.id,
        name=workspace.name,
        business_category=workspace.business_category,
        knowledge_base=workspace.knowledge_base or "",
        whatsapp_provider=get_settings().whatsapp_provider,
        ai_enabled=bool(get_settings().openai_api_key),
    )


async def _get_workspace(session: AsyncSession, workspace_id: str) -> WorkspaceModel:
    workspace = await session.get(WorkspaceModel, workspace_id)
    if workspace is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace no encontrado")
    return workspace


@router.get("", response_model=WorkspaceSettingsResponse)
async def read_workspace_settings(
    workspace_id: WorkspaceId,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> WorkspaceSettingsResponse:
    return _to_response(await _get_workspace(session, workspace_id))


@router.patch("", response_model=WorkspaceSettingsResponse)
async def update_workspace_settings(
    workspace_id: WorkspaceId,
    body: UpdateWorkspaceSettingsRequest,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> WorkspaceSettingsResponse:
    role = await user_repository.get_workspace_role(user.id, workspace_id)
    if getattr(role, "value", role) == "viewer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tu rol solo permite ver la configuración")

    workspace = await _get_workspace(session, workspace_id)
    if body.name is not None:
        workspace.name = body.name.strip()
    if body.business_category is not None:
        workspace.business_category = body.business_category.strip() or None
    if body.knowledge_base is not None:
        workspace.knowledge_base = body.knowledge_base.strip() or None
    await session.commit()
    return _to_response(workspace)
