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
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.conversation_dto import (
    IncomingWhatsAppMessageRequest,
    TransferConversationRequest,
)
from app.application.ports.ai_provider import AIProvider
from app.application.ports.event_bus import EventBus
from app.application.ports.messaging_provider import MessagingProvider
from app.application.ports.repositories.conversation_repository import ConversationRepository
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.use_cases.process_incoming_whatsapp_message import (
    ProcessIncomingWhatsAppMessageUseCase,
)
from app.application.use_cases.transfer_conversation_to_human import (
    TransferConversationToHumanUseCase,
)
from app.domain.entities.conversation import Conversation
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
    workspace_id = payload.get("session", "")
    from_phone = (payload.get("from") or "").replace("@c.us", "")
    text = payload.get("body", "")

    if not workspace_id or not from_phone:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Payload de webhook incompleto")

    use_case = ProcessIncomingWhatsAppMessageUseCase(
        conversation_repository=conversation_repository,
        lead_repository=lead_repository,
        ai_provider=ai_provider,
        messaging_provider=messaging_provider,
        event_bus=event_bus,
        knowledge_base_lookup=default_knowledge_base_lookup,
    )
    await use_case.execute(
        IncomingWhatsAppMessageRequest(workspace_id=workspace_id, from_phone=from_phone, text=text)
    )
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


@router.post("/conversations/{conversation_id}/transfer", status_code=status.HTTP_204_NO_CONTENT)
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
