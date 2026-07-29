"""
Mapper: Conversation ↔ ConversationModel (incluye mensajes).
"""
from __future__ import annotations

from app.domain.entities.conversation import Conversation, Message, MessageDirection, MessageSender
from app.infrastructure.database.models.conversation import ConversationModel, MessageModel


class MessageMapper:
    @staticmethod
    def to_entity(model: MessageModel) -> Message:
        return Message(
            id=model.id,
            direction=MessageDirection(model.direction),
            sender=MessageSender(model.sender),
            text=model.text,
            sent_at=model.sent_at,
        )

    @staticmethod
    def to_model(entity: Message, conversation_id: str) -> MessageModel:
        return MessageModel(
            id=entity.id,
            conversation_id=conversation_id,
            direction=entity.direction.value,
            sender=entity.sender.value,
            text=entity.text,
            sent_at=entity.sent_at,
        )


class ConversationMapper:
    @staticmethod
    def to_entity(model: ConversationModel) -> Conversation:
        return Conversation(
            id=model.id,
            workspace_id=model.workspace_id,
            lead_id=model.lead_id,
            phone=model.phone,
            messages=[MessageMapper.to_entity(m) for m in model.messages],
            is_transferred_to_human=model.is_transferred_to_human,
            assigned_human_user_id=model.assigned_human_user_id,
            created_at=model.created_at,
        )

    @staticmethod
    def to_model(entity: Conversation) -> ConversationModel:
        return ConversationModel(
            id=entity.id,
            workspace_id=entity.workspace_id,
            lead_id=entity.lead_id,
            phone=entity.phone,
            is_transferred_to_human=entity.is_transferred_to_human,
            assigned_human_user_id=entity.assigned_human_user_id,
            created_at=entity.created_at,
            messages=[MessageMapper.to_model(m, entity.id) for m in entity.messages],
        )
