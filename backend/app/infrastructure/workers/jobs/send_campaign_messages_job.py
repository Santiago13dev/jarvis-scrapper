"""
Job de ARQ: send_campaign_messages.

Función top-level, con la firma que ARQ requiere `async def fn(ctx, *args)`. Construye
sus propias dependencias (no usa FastAPI Depends, porque corre en un proceso worker
aparte) usando exactamente los mismos Ports y adapters que la API.
"""
from __future__ import annotations

from app.application.use_cases.send_campaign_messages import SendCampaignMessagesUseCase
from app.infrastructure.adapters.messaging.openwa_adapter import OpenWAAdapter
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.repositories.postgres_campaign_repository import PostgresCampaignRepository
from app.infrastructure.repositories.postgres_conversation_repository import (
    PostgresConversationRepository,
)
from app.infrastructure.repositories.postgres_lead_repository import PostgresLeadRepository
from app.infrastructure.repositories.postgres_template_repository import PostgresTemplateRepository


async def send_campaign_messages(ctx, payload: dict) -> dict:
    workspace_id = payload["workspace_id"]
    campaign_id = payload["campaign_id"]

    async with AsyncSessionLocal() as session:
        use_case = SendCampaignMessagesUseCase(
            campaign_repository=PostgresCampaignRepository(session),
            lead_repository=PostgresLeadRepository(session),
            template_repository=PostgresTemplateRepository(session),
            conversation_repository=PostgresConversationRepository(session),
            messaging_provider=OpenWAAdapter(),
        )
        sent_count = await use_case.execute(workspace_id, campaign_id)
        await session.commit()

    return {"workspace_id": workspace_id, "campaign_id": campaign_id, "sent_count": sent_count}
