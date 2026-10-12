"""
Router: /api/v1/workspaces/{workspace_id}/campaigns
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.campaign_dto import ChangeCampaignStatusRequest, CreateCampaignRequest
from app.application.ports.event_bus import EventBus
from app.application.ports.queue_provider import QueueProvider
from app.application.ports.repositories.campaign_repository import CampaignRepository
from app.application.use_cases.change_campaign_status import ChangeCampaignStatusUseCase
from app.application.use_cases.create_campaign import CreateCampaignUseCase
from app.domain.entities.campaign import Campaign
from app.domain.exceptions.errors import InvalidCampaignTransitionError
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import (
    get_campaign_repository,
    get_event_bus,
    get_queue_provider,
    require_workspace_access,
)

from .schemas import CampaignResponse, ChangeCampaignStatusBody, CreateCampaignBody

router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]


def _to_response(campaign: Campaign) -> CampaignResponse:
    return CampaignResponse(
        id=campaign.id,
        workspace_id=campaign.workspace_id,
        name=campaign.name,
        message_template_id=campaign.message_template_id,
        lead_ids=campaign.lead_ids,
        status=campaign.status.value,
        scheduled_at=campaign.scheduled_at,
        created_at=campaign.created_at,
    )


@router.get("", response_model=list[CampaignResponse])
async def list_campaigns(
    workspace_id: WorkspaceId,
    campaign_repository: Annotated[CampaignRepository, Depends(get_campaign_repository)],
    status_filter: str | None = None,
) -> list[CampaignResponse]:
    campaigns = await campaign_repository.list_by_workspace(workspace_id, status=status_filter)
    return [_to_response(c) for c in campaigns]


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    workspace_id: WorkspaceId,
    campaign_id: str,
    campaign_repository: Annotated[CampaignRepository, Depends(get_campaign_repository)],
) -> CampaignResponse:
    campaign = await campaign_repository.get_by_id(workspace_id, campaign_id)
    if campaign is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaña no encontrada")
    return _to_response(campaign)


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    workspace_id: WorkspaceId,
    body: CreateCampaignBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    campaign_repository: Annotated[CampaignRepository, Depends(get_campaign_repository)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
) -> CampaignResponse:
    use_case = CreateCampaignUseCase(campaign_repository, event_bus)
    campaign = await use_case.execute(
        CreateCampaignRequest(
            workspace_id=workspace_id,
            name=body.name,
            message_template_id=body.message_template_id,
            lead_ids=body.lead_ids,
            scheduled_at=body.scheduled_at,
        )
    )
    await session.commit()
    return _to_response(campaign)


@router.patch("/{campaign_id}/status", response_model=CampaignResponse)
async def change_campaign_status(
    workspace_id: WorkspaceId,
    campaign_id: str,
    body: ChangeCampaignStatusBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    campaign_repository: Annotated[CampaignRepository, Depends(get_campaign_repository)],
    queue_provider: Annotated[QueueProvider, Depends(get_queue_provider)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
) -> CampaignResponse:
    from app.infrastructure.config.config import get_settings

    if body.action in ("start", "resume", "run") and get_settings().whatsapp_provider.lower() == "assisted":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Modo asistido: los mensajes de la campaña se envían desde «Contactar hoy», uno por uno, "
            "con el texto ya listo. Para envíos automáticos configura la API oficial de WhatsApp.",
        )
    use_case = ChangeCampaignStatusUseCase(campaign_repository, queue_provider, event_bus)
    try:
        campaign = await use_case.execute(
            ChangeCampaignStatusRequest(
                workspace_id=workspace_id, campaign_id=campaign_id, action=body.action
            )
        )
    except InvalidCampaignTransitionError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await session.commit()
    return _to_response(campaign)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_campaign(
    workspace_id: WorkspaceId,
    campaign_id: str,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    campaign_repository: Annotated[CampaignRepository, Depends(get_campaign_repository)],
) -> None:
    campaign = await campaign_repository.get_by_id(workspace_id, campaign_id)
    if campaign is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaña no encontrada")
    await campaign_repository.delete(workspace_id, campaign_id)
    await session.commit()
