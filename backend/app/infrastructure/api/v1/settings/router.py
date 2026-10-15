"""
Router: /api/v1/workspaces/{workspace_id}/settings
Ajustes comerciales del workspace y estado en vivo de las integraciones.
"""
from __future__ import annotations

import asyncio
from typing import Annotated

import httpx
import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.config.config import get_settings
from app.infrastructure.database.models.workspace import WorkspaceModel
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import require_workspace_access

router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]
Session = Annotated[AsyncSession, Depends(get_db_session)]

# ARQ renueva esta clave mientras el worker está vivo (cola por defecto "arq:queue")
ARQ_HEALTH_KEY = "arq:queue:health-check"


class WorkspaceSettings(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    outreach_signature: str = Field(min_length=1, max_length=120)
    daily_send_limit: int = Field(ge=5, le=100)
    follow_up_days: int = Field(ge=1, le=14)
    min_score: int = Field(ge=0, le=100)
    knowledge_base: str | None = Field(default=None, max_length=20000)


class IntegrationStatus(BaseModel):
    key: str
    ok: bool
    detail: str


@router.get("", response_model=WorkspaceSettings)
async def get_workspace_settings(workspace_id: WorkspaceId, session: Session) -> WorkspaceSettings:
    workspace = await _get_workspace(session, workspace_id)
    return WorkspaceSettings.model_validate(workspace, from_attributes=True)


@router.put("", response_model=WorkspaceSettings)
async def update_workspace_settings(
    workspace_id: WorkspaceId, body: WorkspaceSettings, session: Session
) -> WorkspaceSettings:
    workspace = await _get_workspace(session, workspace_id)
    for key, value in body.model_dump().items():
        setattr(workspace, key, value.strip() if isinstance(value, str) else value)
    await session.commit()
    return WorkspaceSettings.model_validate(workspace, from_attributes=True)


@router.get("/integrations", response_model=list[IntegrationStatus])
async def get_integrations(workspace_id: WorkspaceId) -> list[IntegrationStatus]:
    settings = get_settings()
    whatsapp, scraper, worker = await asyncio.gather(
        _check_whatsapp(settings.openwa_base_url), _check_scraper(settings.scraper_api_url), _check_worker(settings.redis_url)
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


async def _check_whatsapp(base_url: str) -> IntegrationStatus:
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
