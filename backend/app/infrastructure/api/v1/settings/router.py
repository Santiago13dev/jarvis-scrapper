"""
Router: /api/v1/workspaces/{workspace_id}/settings
Ajustes del workspace (pantalla Configuración) y estado en vivo de las integraciones.
El proveedor de WhatsApp y la IA se definen en el .env del servidor y aquí son de solo lectura.
"""
from __future__ import annotations

import asyncio
from typing import Annotated

import httpx
import redis.asyncio as redis
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
Session = Annotated[AsyncSession, Depends(get_db_session)]

# ARQ renueva esta clave mientras el worker está vivo (cola por defecto "arq:queue")
ARQ_HEALTH_KEY = "arq:queue:health-check"


class WorkspaceSettings(BaseModel):
    id: str
    name: str
    business_category: str | None
    knowledge_base: str
    outreach_signature: str
    daily_send_limit: int
    follow_up_days: int
    min_score: int
    whatsapp_provider: str
    ai_enabled: bool


class UpdateWorkspaceSettings(BaseModel):
    """Actualización parcial: solo se cambian los campos enviados."""
    name: str | None = Field(default=None, min_length=1, max_length=255)
    business_category: str | None = Field(default=None, max_length=100)
    knowledge_base: str | None = Field(default=None, max_length=20000)
    outreach_signature: str | None = Field(default=None, min_length=1, max_length=120)
    daily_send_limit: int | None = Field(default=None, ge=5, le=100)
    follow_up_days: int | None = Field(default=None, ge=1, le=14)
    min_score: int | None = Field(default=None, ge=0, le=100)


class IntegrationStatus(BaseModel):
    key: str
    ok: bool
    detail: str


def _to_response(workspace: WorkspaceModel) -> WorkspaceSettings:
    settings = get_settings()
    return WorkspaceSettings(
        id=workspace.id,
        name=workspace.name,
        business_category=workspace.business_category,
        knowledge_base=workspace.knowledge_base or "",
        outreach_signature=workspace.outreach_signature,
        daily_send_limit=workspace.daily_send_limit,
        follow_up_days=workspace.follow_up_days,
        min_score=workspace.min_score,
        whatsapp_provider=settings.whatsapp_provider,
        ai_enabled=bool(settings.openai_api_key),
    )


@router.get("", response_model=WorkspaceSettings)
async def get_workspace_settings(workspace_id: WorkspaceId, session: Session) -> WorkspaceSettings:
    return _to_response(await _get_workspace(session, workspace_id))


@router.patch("", response_model=WorkspaceSettings)
async def update_workspace_settings(
    workspace_id: WorkspaceId,
    body: UpdateWorkspaceSettings,
    user: CurrentUser,
    session: Session,
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> WorkspaceSettings:
    role = await user_repository.get_workspace_role(user.id, workspace_id)
    if getattr(role, "value", role) == "viewer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tu rol solo permite ver la configuración")

    workspace = await _get_workspace(session, workspace_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip()
            if key in ("business_category", "knowledge_base"):
                value = value or None
        if value is None and key not in ("business_category", "knowledge_base"):
            continue
        setattr(workspace, key, value)
    await session.commit()
    return _to_response(workspace)


@router.put("", response_model=WorkspaceSettings)
async def replace_workspace_settings(
    workspace_id: WorkspaceId,
    body: UpdateWorkspaceSettings,
    user: CurrentUser,
    session: Session,
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> WorkspaceSettings:
    """Igual que PATCH: la pantalla de Configuración envía el formulario completo."""
    return await update_workspace_settings(workspace_id, body, user, session, user_repository)


@router.get("/integrations", response_model=list[IntegrationStatus])
async def get_integrations(workspace_id: WorkspaceId) -> list[IntegrationStatus]:
    settings = get_settings()
    whatsapp, scraper, worker = await asyncio.gather(
        _check_whatsapp(settings.openwa_base_url, settings.whatsapp_provider),
        _check_scraper(settings.scraper_api_url),
        _check_worker(settings.redis_url),
    )
    openai = IntegrationStatus(
        key="openai",
        ok=bool(settings.openai_api_key),
        detail="Respuestas automáticas con IA activas" if settings.openai_api_key else "Sin OPENAI_API_KEY: las respuestas pasan a un humano",
    )
    return [whatsapp, scraper, worker, openai]


async def _get_workspace(session: AsyncSession, workspace_id: str) -> WorkspaceModel:
    workspace = await session.get(WorkspaceModel, workspace_id)
    if workspace is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace no encontrado")
    return workspace


async def _check_whatsapp(base_url: str, provider: str) -> IntegrationStatus:
    if provider == "assisted":
        return IntegrationStatus(key="whatsapp", ok=True, detail="Modo asistido: tú envías cada mensaje desde tu WhatsApp con un toque")
    if provider == "cloud_api":
        configured = bool(get_settings().whatsapp_cloud_token and get_settings().whatsapp_cloud_phone_number_id)
        return IntegrationStatus(
            key="whatsapp", ok=configured,
            detail="API oficial de WhatsApp (Meta) configurada" if configured else "Faltan WHATSAPP_CLOUD_TOKEN o WHATSAPP_CLOUD_PHONE_NUMBER_ID",
        )
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            data = (await client.get(f"{base_url.rstrip('/')}/me")).json()
    except (httpx.HTTPError, ValueError):
        return IntegrationStatus(key="whatsapp", ok=False, detail="El servidor de WhatsApp no responde")
    if data.get("status") == "WORKING":
        number = f" +{data['phone']}" if data.get("phone") else ""
        return IntegrationStatus(key="whatsapp", ok=True, detail=f"Conectado{number}")
    return IntegrationStatus(key="whatsapp", ok=False, detail="Falta escanear el código QR")


async def _check_scraper(base_url: str) -> IntegrationStatus:
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            response = await client.get(f"{base_url.rstrip('/')}/api/v1/jobs")
        ok = response.status_code < 500
    except httpx.HTTPError:
        ok = False
    return IntegrationStatus(key="scraper", ok=ok, detail="Google Maps listo para buscar" if ok else "El scraper de Google Maps no responde")


async def _check_worker(redis_url: str) -> IntegrationStatus:
    client = redis.from_url(redis_url)
    try:
        alive = bool(await client.exists(ARQ_HEALTH_KEY))
    except redis.RedisError:
        alive = False
    finally:
        await client.aclose()
    return IntegrationStatus(
        key="worker",
        ok=alive,
        detail="Piloto automático y envíos programados en marcha" if alive else "El worker no está corriendo: no habrá envíos ni búsquedas automáticas",
    )
