"""
Caso de uso: CreateCampaignUseCase.
"""
from __future__ import annotations

from app.application.dto.campaign_dto import CreateCampaignRequest
from app.application.ports.event_bus import EventBus
from app.application.ports.repositories.campaign_repository import CampaignRepository
from app.domain.entities.campaign import Campaign
from app.domain.events.domain_events import CampaignCreatedEvent


class CreateCampaignUseCase:
    def __init__(self, campaign_repository: CampaignRepository, event_bus: EventBus) -> None:
        self._campaigns = campaign_repository
        self._event_bus = event_bus

    async def execute(self, request: CreateCampaignRequest) -> Campaign:
        campaign = Campaign(
            workspace_id=request.workspace_id,
            name=request.name,
            message_template_id=request.message_template_id,
            lead_ids=list(request.lead_ids),
            scheduled_at=request.scheduled_at,
        )
        created = await self._campaigns.create(request.workspace_id, campaign)

        await self._event_bus.publish(
            CampaignCreatedEvent(workspace_id=request.workspace_id, campaign_id=created.id)
        )
        return created
