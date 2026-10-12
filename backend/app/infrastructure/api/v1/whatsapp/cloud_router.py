"""
Router: /api/v1/whatsapp/cloud — webhook de WhatsApp Business Cloud API (Meta).

- GET  /webhook: verificación inicial que hace Meta (hub.verify_token).
- POST /webhook: mensajes entrantes, firmados con X-Hub-Signature-256.

Configuración: WHATSAPP_CLOUD_VERIFY_TOKEN, WHATSAPP_CLOUD_APP_SECRET y
WHATSAPP_CLOUD_WORKSPACE_ID (workspace que recibe las conversaciones).
"""
from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.conversation_dto import IncomingWhatsAppMessageRequest
from app.application.ports.ai_provider import AIProvider
from app.application.ports.event_bus import EventBus
from app.application.ports.messaging_provider import MessagingProvider
from app.application.ports.repositories.conversation_repository import ConversationRepository
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.use_cases.process_incoming_whatsapp_message import ProcessIncomingWhatsAppMessageUseCase
from app.infrastructure.adapters.messaging.whatsapp_cloud_adapter import parse_inbound, verify_signature
from app.infrastructure.config.config import get_settings
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import (
    default_knowledge_base_lookup,
    get_ai_provider,
    get_conversation_repository,
    get_event_bus,
    get_lead_repository,
    get_messaging_provider,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/webhook", response_class=PlainTextResponse)
async def verify_webhook(
    mode: Annotated[str | None, Query(alias="hub.mode")] = None,
    token: Annotated[str | None, Query(alias="hub.verify_token")] = None,
    challenge: Annotated[str | None, Query(alias="hub.challenge")] = None,
) -> str:
    expected = get_settings().whatsapp_cloud_verify_token
    if mode == "subscribe" and expected and token == expected and challenge:
        return challenge
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Verificación del webhook rechazada")


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    conversation_repository: Annotated[ConversationRepository, Depends(get_conversation_repository)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    ai_provider: Annotated[AIProvider, Depends(get_ai_provider)],
    messaging_provider: Annotated[MessagingProvider, Depends(get_messaging_provider)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
) -> dict[str, int]:
    settings = get_settings()
    raw = await request.body()
    if not verify_signature(raw, request.headers.get("X-Hub-Signature-256"), settings.whatsapp_cloud_app_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Firma inválida")
    if not settings.whatsapp_cloud_workspace_id:
        logger.error("Mensaje de WhatsApp Cloud recibido sin WHATSAPP_CLOUD_WORKSPACE_ID configurado")
        return {"processed": 0}

    use_case = ProcessIncomingWhatsAppMessageUseCase(
        conversation_repository=conversation_repository,
        lead_repository=lead_repository,
        ai_provider=ai_provider,
        messaging_provider=messaging_provider,
        event_bus=event_bus,
        knowledge_base_lookup=default_knowledge_base_lookup,
    )
    processed = 0
    for phone, text in parse_inbound(json.loads(raw or b"{}")):
        await use_case.execute(
            IncomingWhatsAppMessageRequest(workspace_id=settings.whatsapp_cloud_workspace_id, from_phone=phone, text=text)
        )
        processed += 1
    await session.commit()
    # Meta reintenta si no recibe 200: siempre se responde OK tras procesar.
    return {"processed": processed}
