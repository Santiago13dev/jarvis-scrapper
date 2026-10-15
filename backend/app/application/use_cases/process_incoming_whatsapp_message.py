"""
Caso de uso: ProcessIncomingWhatsAppMessageUseCase.

Flujo: recibe mensaje entrante → obtiene/crea Conversation → guarda mensaje inbound →
genera respuesta con AIProvider usando SOLO la base de conocimiento del workspace →
si la IA decide transferir, marca la conversación y NO responde automáticamente más →
si no, envía la respuesta vía MessagingProvider y la guarda como mensaje outbound.
"""
from __future__ import annotations

import logging
from typing import Awaitable, Callable

from app.application.dto.conversation_dto import IncomingWhatsAppMessageRequest
from app.application.ports.ai_provider import AIProvider, ChatContext
from app.application.ports.event_bus import EventBus
from app.application.ports.messaging_provider import MessagingProvider, OutboundMessage
from app.application.ports.repositories.conversation_repository import ConversationRepository
from app.application.ports.repositories.lead_repository import LeadRepository
from app.domain.entities.conversation import Conversation, Message, MessageDirection, MessageSender
from app.application.services.outreach_message_service import OutreachMessageService
from app.domain.events.domain_events import ConversationTransferredToHumanEvent, MessageSentEvent

logger = logging.getLogger(__name__)

# Función que dado un workspace_id devuelve su base de conocimiento configurable
# (ej. desde una tabla de settings, un documento, o un servicio externo). Se inyecta
# como dependencia para no acoplar este caso de uso a dónde vive esa configuración.
KnowledgeBaseLookup = Callable[[str], Awaitable[str]]


class ProcessIncomingWhatsAppMessageUseCase:
    def __init__(
        self,
        conversation_repository: ConversationRepository,
        lead_repository: LeadRepository,
        ai_provider: AIProvider,
        messaging_provider: MessagingProvider,
        event_bus: EventBus,
        knowledge_base_lookup: KnowledgeBaseLookup,
    ) -> None:
        self._conversations = conversation_repository
        self._leads = lead_repository
        self._ai = ai_provider
        self._messaging = messaging_provider
        self._event_bus = event_bus
        self._knowledge_base_lookup = knowledge_base_lookup

    async def execute(self, request: IncomingWhatsAppMessageRequest) -> Conversation:
        conversation = await self._conversations.get_by_phone(request.workspace_id, request.from_phone)
        if conversation is None:
            lead = await self._find_or_create_lead_stub(request.workspace_id, request.from_phone)
            conversation = Conversation(
                workspace_id=request.workspace_id, lead_id=lead.id, phone=request.from_phone
            )
            conversation = await self._conversations.create(request.workspace_id, conversation)

        inbound = Message(direction=MessageDirection.INBOUND, sender=MessageSender.LEAD, text=request.text)
        await self._conversations.append_message(request.workspace_id, conversation.id, inbound)

        if conversation.is_transferred_to_human:
            # Ya transferida: no se auto-responde, un humano la está atendiendo.
            return conversation

        if OutreachMessageService.is_opt_out(request.text):
            # Pidió no ser contactado: nunca se le responde automáticamente
            return conversation

        knowledge_base = await self._knowledge_base_lookup(request.workspace_id)

        history = [
            {"role": "user" if m.sender == MessageSender.LEAD else "assistant", "content": m.text}
            for m in conversation.messages
        ]

        try:
            chat_response = await self._ai.generate_chat_reply(
                ChatContext(
                    conversation_history=history,
                    knowledge_base=knowledge_base,
                    tenant_id=request.workspace_id,
                ),
                request.text,
            )
        except Exception:
            # Sin IA configurada (o caída): el lead que respondió lo atiende una persona
            logger.exception("No se pudo generar respuesta automática; se transfiere a humano")
            chat_response = None

        if chat_response is None or chat_response.should_transfer_to_human:
            await self._conversations.mark_transferred_to_human(request.workspace_id, conversation.id)
            await self._event_bus.publish(
                ConversationTransferredToHumanEvent(
                    workspace_id=request.workspace_id,
                    conversation_id=conversation.id,
                    reason=(chat_response.detected_intent if chat_response else None) or "ai_could_not_answer",
                )
            )
            return conversation

        await self._messaging.send_message(
            OutboundMessage(
                tenant_id=request.workspace_id, to_phone=request.from_phone, text=chat_response.reply
            )
        )
        outbound = Message(
            direction=MessageDirection.OUTBOUND, sender=MessageSender.AI_AGENT, text=chat_response.reply
        )
        await self._conversations.append_message(request.workspace_id, conversation.id, outbound)

        await self._event_bus.publish(
            MessageSentEvent(
                workspace_id=request.workspace_id,
                conversation_id=conversation.id,
                message_id=outbound.id,
            )
        )

        return conversation

    async def _find_or_create_lead_stub(self, workspace_id: str, phone: str):
        """
        Un mensaje entrante puede venir de un número que no está en la base de Leads
        (ej. alguien que encontró el WhatsApp orgánicamente, no vía scraping). Se crea
        un Lead mínimo para poder asociar la conversación.
        """
        from app.domain.entities.lead import Lead  # import local para evitar ciclo

        stub = Lead(workspace_id=workspace_id, name=f"Contacto {phone}", raw_source_id=None, whatsapp=phone)
        created = await self._leads.bulk_create(workspace_id, [stub])
        return created[0]
