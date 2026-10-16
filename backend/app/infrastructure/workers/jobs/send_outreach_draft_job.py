"""
Job: send_outreach_draft — envía un mensaje aprobado en su horario programado con el
proveedor configurado (OpenWA o API oficial de Meta). En modo asistido no se usa: la
persona envía cada mensaje desde su WhatsApp y se registra con `record_outreach_sent`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.messaging_provider import OutboundMessage
from app.application.services.follow_up_service import FollowUpService
from app.application.services.outreach_service import FOLLOW_UP_AFTER
from app.domain.entities.conversation import Conversation, Message, MessageDirection, MessageSender
from app.domain.entities.lead import Lead, LeadStatus
from app.infrastructure.adapters.queue.arq_queue_adapter import ArqQueueAdapter
from app.infrastructure.database.models.automation import OutreachDraftModel
from app.infrastructure.database.models.workspace import WorkspaceModel
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.dependencies.providers import get_messaging_provider
from app.infrastructure.repositories.postgres_conversation_repository import PostgresConversationRepository
from app.infrastructure.repositories.postgres_lead_repository import PostgresLeadRepository

logger = logging.getLogger(__name__)

EXPECTED_LEAD_STATUS = {"first_touch": LeadStatus.NEW, "follow_up": LeadStatus.CONTACTED}


def lead_still_contactable(lead: Lead | None, draft: OutreachDraftModel) -> bool:
    """El lead pudo responder, pedir no ser contactado o cambiar de etapa mientras esperaba."""
    return lead is not None and not lead.do_not_contact and lead.status == EXPECTED_LEAD_STATUS.get(draft.kind, lead.status)


async def record_outreach_sent(session: AsyncSession, draft: OutreachDraftModel, lead: Lead) -> None:
    """Deja el envío en la conversación, registra el contacto y agenda el seguimiento."""
    now = datetime.now(timezone.utc)
    conversations = PostgresConversationRepository(session)
    conversation = await conversations.get_by_phone(draft.workspace_id, draft.to_phone)
    if conversation is None:
        conversation = await conversations.create(
            draft.workspace_id, Conversation(workspace_id=draft.workspace_id, lead_id=lead.id, phone=draft.to_phone)
        )
    await conversations.append_message(
        draft.workspace_id,
        conversation.id,
        Message(direction=MessageDirection.OUTBOUND, sender=MessageSender.HUMAN_AGENT, text=draft.message),
    )

    draft.status = "sent"
    draft.sent_at = now
    lead.register_contact(now)
    await PostgresLeadRepository(session).update(draft.workspace_id, lead)
    if draft.kind == "first_touch":
        workspace = await session.get(WorkspaceModel, draft.workspace_id)
        follow_up_after = timedelta(days=workspace.follow_up_days) if workspace else FOLLOW_UP_AFTER
        await FollowUpService(session, ArqQueueAdapter()).create(draft.workspace_id, lead.id, now + follow_up_after)


async def send_outreach_draft(ctx, payload: dict) -> dict:
    draft_id = payload["draft_id"]
    async with AsyncSessionLocal() as session:
        draft = await session.get(OutreachDraftModel, draft_id)
        if draft is None or draft.status != "approved":
            return {"draft_id": draft_id, "status": "skipped"}

        lead = await PostgresLeadRepository(session).get_by_id(draft.workspace_id, draft.lead_id)
        if not lead_still_contactable(lead, draft):
            draft.status = "rejected"
            draft.error = "El lead cambió de estado antes del envío"
            await session.commit()
            return {"draft_id": draft_id, "status": "rejected"}

        try:
            await get_messaging_provider().send_message(
                OutboundMessage(tenant_id=draft.workspace_id, to_phone=draft.to_phone, text=draft.message)
            )
        except Exception as exc:
            logger.exception("Falló el envío del borrador %s", draft_id)
            draft.status = "failed"
            draft.error = str(exc)[:500]
            await session.commit()
            return {"draft_id": draft_id, "status": "failed"}

        await record_outreach_sent(session, draft, lead)
        await session.commit()

    return {"draft_id": draft_id, "status": "sent"}
