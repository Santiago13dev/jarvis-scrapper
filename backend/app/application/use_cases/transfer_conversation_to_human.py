"""
Caso de uso: TransferConversationToHumanUseCase.

Transferencia manual (ej. un agente humano decide tomar la conversación), distinta de
la transferencia automática que decide la IA dentro de ProcessIncomingWhatsAppMessageUseCase.
"""
from __future__ import annotations

from app.application.dto.conversation_dto import TransferConversationRequest
from app.application.ports.event_bus import EventBus
from app.application.ports.repositories.conversation_repository import ConversationRepository
from app.domain.events.domain_events import ConversationTransferredToHumanEvent


class TransferConversationToHumanUseCase:
    def __init__(
        self, conversation_repository: ConversationRepository, event_bus: EventBus
    ) -> None:
        self._conversations = conversation_repository
        self._event_bus = event_bus

    async def execute(self, request: TransferConversationRequest) -> None:
        conversation = await self._conversations.get_by_id(request.workspace_id, request.conversation_id)
        if conversation is None:
            raise ValueError(f"Conversation {request.conversation_id} no encontrada")

        await self._conversations.mark_transferred_to_human(request.workspace_id, request.conversation_id)

        await self._event_bus.publish(
            ConversationTransferredToHumanEvent(
                workspace_id=request.workspace_id,
                conversation_id=request.conversation_id,
                reason=request.reason,
            )
        )
