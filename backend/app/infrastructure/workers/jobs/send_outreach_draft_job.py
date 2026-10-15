"""
Job: send_outreach_draft — envía un mensaje aprobado en su horario programado, lo registra
en la conversación, marca el lead como contactado y agenda el seguimiento automático.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.application.ports.messaging_provider import OutboundMessage
from app.application.services.follow_up_service import FollowUpService
from app.application.services.outreach_service import FOLLOW_UP_AFTER
from app.domain.entities.conversation import Conversation, Message, MessageDirection, MessageSender
from app.domain.entities.lead import LeadStatus
from app.infrastructure.adapters.messaging.openwa_adapter import OpenWAAdapter
from app.infrastructure.adapters.queue.arq_queue_adapter import ArqQueueAdapter
from app.infrastructure.database.models.automation import OutreachDraftModel
from app.infrastructure.database.models.workspace import WorkspaceModel
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.repositories.postgres_conversation_repository import PostgresConversationRepository
from app.infrastructure.repositories.postgres_lead_repository import PostgresLeadRepository

logger = logging.getLogger(__name__)

EXPECTED_LEAD_STATUS = {"first_touch": LeadStatus.NEW, "follow_up": LeadStatus.CONTACTED}


async def send_outreach_draft(ctx, payload: dict) -> dict:
    draft_id = payload["draft_id"]
    async with AsyncSessionLocal() as session:
        draft = await session.get(OutreachDraftModel, draft_id)
        if draft is None or draft.status != "approved":
            return {"draft_id": draft_id, "status": "skipped"}

        leads = PostgresLeadRepository(session)
        lead = await leads.get_by_id(draft.workspace_id, draft.lead_id)
        if lead is None or lead.do_not_contact or lead.status != EXPECTED_LEAD_STATUS.get(draft.kind, lead.status):
            # El lead respondió, pidió no ser contactado o cambió de etapa mientras esperaba
            draft.status = "rejected"
            draft.error = "El lead cambió de estado antes del envío"
            await session.commit()
            return {"draft_id": draft_id, "status": "rejected"}

        try:
            await OpenWAAdapter().send_message(
                OutboundMessage(tenant_id=draft.workspace_id, to_phone=draft.to_phone, text=draft.message)
            )
        except Exception as exc:
            logger.exception("Falló el envío del borrador %s", draft_id)
            draft.status = "failed"
            draft.error = str(exc)[:500]
            await session.commit()
            return {"draft_id": draft_id, "status": "failed"}

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
        if draft.kind == "first_touch":
            lead.change_status(LeadStatus.CONTACTED)
            await leads.update(draft.workspace_id, lead)
            workspace = await session.get(WorkspaceModel, draft.workspace_id)
            follow_up_after = timedelta(days=workspace.follow_up_days) if workspace else FOLLOW_UP_AFTER
            await FollowUpService(session, ArqQueueAdapter()).create(draft.workspace_id, lead.id, now + follow_up_after)
        await session.commit()

    return {"draft_id": draft_id, "status": "sent"}
