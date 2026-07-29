"""
Caso de uso: ChangeCampaignStatusUseCase (pause / resume / finish).

Las transiciones válidas las valida la propia entidad `Campaign` (dominio), no este
caso de uso. Al pasar a RUNNING, encola el job de envío vía QueueProvider (ARQ) en vez
de enviar los mensajes de forma síncrona.
"""
from __future__ import annotations

from app.application.dto.campaign_dto import ChangeCampaignStatusRequest
from app.application.ports.event_bus import EventBus
from app.application.ports.queue_provider import QueueProvider
from app.application.ports.repositories.campaign_repository import CampaignRepository
from app.domain.entities.campaign import Campaign, CampaignStatus
from app.domain.events.domain_events import CampaignStatusChangedEvent

_ACTIONS = {
    "pause": lambda c: c.pause(),
    "resume": lambda c: c.resume(),
    "finish": lambda c: c.finish(),
}

SEND_CAMPAIGN_MESSAGES_JOB = "send_campaign_messages"


class ChangeCampaignStatusUseCase:
    def __init__(
        self,
        campaign_repository: CampaignRepository,
        queue_provider: QueueProvider,
        event_bus: EventBus,
    ) -> None:
        self._campaigns = campaign_repository
        self._queue = queue_provider
        self._event_bus = event_bus

    async def execute(self, request: ChangeCampaignStatusRequest) -> Campaign:
        campaign = await self._campaigns.get_by_id(request.workspace_id, request.campaign_id)
        if campaign is None:
            raise ValueError(f"Campaign {request.campaign_id} no encontrada")

        transition = _ACTIONS.get(request.action)
        if transition is None:
            raise ValueError(f"Acción de campaña desconocida: {request.action}")

        transition(campaign)  # valida la transición según las reglas del dominio
        updated = await self._campaigns.update(request.workspace_id, campaign)

        await self._event_bus.publish(
            CampaignStatusChangedEvent(
                workspace_id=request.workspace_id,
                campaign_id=updated.id,
                new_status=updated.status.value,
            )
        )

        if updated.status == CampaignStatus.RUNNING:
            await self._queue.enqueue(
                SEND_CAMPAIGN_MESSAGES_JOB,
                {"workspace_id": request.workspace_id, "campaign_id": updated.id},
            )

        return updated
