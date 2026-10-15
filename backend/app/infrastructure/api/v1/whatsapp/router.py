"""
Router: WhatsApp.

Se exportan dos routers distintos porque tienen semánticas de auth diferentes:

- `webhook_router`: público (lo llama el servidor OpenWA, no un usuario logueado),
  montado en /api/v1/whatsapp/webhook.
- `router`: autenticado y scoped por workspace, montado en
  /api/v1/workspaces/{workspace_id}/whatsapp/...
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.conversation_dto import (
    IncomingWhatsAppMessageRequest,
    TransferConversationRequest,
)
from app.application.ports.ai_provider import AIProvider
from app.application.ports.event_bus import EventBus
from app.application.ports.messaging_provider import MessagingProvider, OutboundMessage
from app.application.ports.repositories.conversation_repository import ConversationRepository
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.use_cases.process_incoming_whatsapp_message import (
    ProcessIncomingWhatsAppMessageUseCase,
)
from app.application.use_cases.transfer_conversation_to_human import (
    TransferConversationToHumanUseCase,
)
from app.application.services.follow_up_service import FollowUpService
from app.application.services.outreach_message_service import OutreachMessageService
from app.application.services.outreach_service import OutreachService
from app.domain.entities.conversation import Conversation, Message, MessageDirection, MessageSender
from app.domain.entities.lead import LeadStatus
from app.infrastructure.database.models.conversation import ConversationModel
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import (
    default_knowledge_base_lookup,
    get_ai_provider,
    get_conversation_repository,
    get_event_bus,
    get_lead_repository,
    get_messaging_provider,
    require_workspace_access,
)

from .schemas import (
    ConversationResponse,
    OpenWAWebhookPayload,
    ReplyBody,
    TransferConversationBody,
    WhatsAppSessionStatusResponse,
)

webhook_router = APIRouter()
router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]


def _to_response(conversation: Conversation) -> ConversationResponse:
    return ConversationResponse(
        id=conversation.id,
        workspace_id=conversation.workspace_id,
        lead_id=conversation.lead_id,
        phone=conversation.phone,
        is_transferred_to_human=conversation.is_transferred_to_human,
        messages=[
            {
                "id": m.id, "direction": m.direction.value, "sender": m.sender.value,
                "text": m.text, "sent_at": m.sent_at.isoformat(),
            }
            for m in conversation.messages
        ],
    )


@webhook_router.post("/webhook", status_code=status.HTTP_200_OK)
async def receive_openwa_webhook(
    payload: dict[str, Any],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    conversation_repository: Annotated[ConversationRepository, Depends(get_conversation_repository)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    ai_provider: Annotated[AIProvider, Depends(get_ai_provider)],
    messaging_provider: Annotated[MessagingProvider, Depends(get_messaging_provider)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
) -> dict[str, str]:
    from_phone = (payload.get("from") or "").replace("@c.us", "")
    text = payload.get("body", "")

    if not from_phone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Payload de webhook incompleto")

    # El número de WhatsApp es personal: solo se procesan chats que Jarvis inició. Así nunca
    # se crean leads ni se responde automáticamente a amigos, familia u otros contactos.
    workspace_id = await session.scalar(
        select(ConversationModel.workspace_id)
        .where(ConversationModel.phone == from_phone)
        .order_by(ConversationModel.created_at.desc())
        .limit(1)
    )
    if workspace_id is None:
        return {"status": "ignored"}

    use_case = ProcessIncomingWhatsAppMessageUseCase(
        conversation_repository=conversation_repository,
        lead_repository=lead_repository,
        ai_provider=ai_provider,
        messaging_provider=messaging_provider,
        event_bus=event_bus,
        knowledge_base_lookup=default_knowledge_base_lookup,
    )
    conversation = await use_case.execute(
        IncomingWhatsAppMessageRequest(workspace_id=workspace_id, from_phone=from_phone, text=text)
    )

    # Respuesta del lead: se detienen seguimientos y mensajes pendientes y avanza el embudo
    lead = await lead_repository.get_by_id(workspace_id, conversation.lead_id)
    if lead is not None:
        if OutreachMessageService.is_opt_out(text):
            lead.do_not_contact = True
        if lead.status in (LeadStatus.NEW, LeadStatus.CONTACTED):
            lead.change_status(LeadStatus.REPLIED)
        await lead_repository.update(workspace_id, lead)
        await FollowUpService(session).cancel_pending_for_lead(workspace_id, lead.id, "lead_replied")
        await OutreachService(session, lead_repository).cancel_pending_for_lead(lead.id)
    await session.commit()
    return {"status": "processed"}


@router.get("/status", response_model=WhatsAppSessionStatusResponse)
async def get_whatsapp_status(
    workspace_id: WorkspaceId,
    messaging_provider: Annotated[MessagingProvider, Depends(get_messaging_provider)],
) -> WhatsAppSessionStatusResponse:
    session_status = await messaging_provider.get_session_status(workspace_id)
    return WhatsAppSessionStatusResponse(workspace_id=workspace_id, status=session_status)


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    workspace_id: WorkspaceId,
    conversation_repository: Annotated[ConversationRepository, Depends(get_conversation_repository)],
    assigned_to_human: bool | None = None,
) -> list[ConversationResponse]:
    conversations = await conversation_repository.list_by_workspace(workspace_id, assigned_to_human)
    return [_to_response(c) for c in conversations]


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    workspace_id: WorkspaceId,
    conversation_id: str,
    conversation_repository: Annotated[ConversationRepository, Depends(get_conversation_repository)],
) -> ConversationResponse:
    conversation = await conversation_repository.get_by_id(workspace_id, conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversación no encontrada")
    return _to_response(conversation)


@router.post("/conversations/{conversation_id}/transfer", status_code=status.HTTP_200_OK)
async def transfer_conversation(
    workspace_id: WorkspaceId,
    conversation_id: str,
    body: TransferConversationBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    conversation_repository: Annotated[ConversationRepository, Depends(get_conversation_repository)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
) -> None:
    use_case = TransferConversationToHumanUseCase(conversation_repository, event_bus)
    try:
        await use_case.execute(
            TransferConversationRequest(
                workspace_id=workspace_id, conversation_id=conversation_id, reason=body.reason
            )
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await session.commit()


@router.post("/conversations/{conversation_id}/messages", response_model=ConversationResponse)
async def reply_to_conversation(
    workspace_id: WorkspaceId,
    conversation_id: str,
    body: ReplyBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    conversation_repository: Annotated[ConversationRepository, Depends(get_conversation_repository)],
    messaging_provider: Annotated[MessagingProvider, Depends(get_messaging_provider)],
) -> ConversationResponse:
    """Respuesta manual desde Jarvis: sale por WhatsApp y queda en el historial de la conversación."""
    conversation = await conversation_repository.get_by_id(workspace_id, conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversación no encontrada")
    try:
        await messaging_provider.send_message(
            OutboundMessage(tenant_id=workspace_id, to_phone=conversation.phone, text=body.text)
        )
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "WhatsApp no está conectado o rechazó el mensaje") from exc
    await conversation_repository.append_message(
        workspace_id,
        conversation.id,
        Message(direction=MessageDirection.OUTBOUND, sender=MessageSender.HUMAN_AGENT, text=body.text),
    )
    await session.commit()
    updated = await conversation_repository.get_by_id(workspace_id, conversation_id)
    return _to_response(updated)
