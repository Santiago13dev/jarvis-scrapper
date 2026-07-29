"""
Adapter: PostgresConversationRepository.
"""
from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.mappers.conversation_mapper import ConversationMapper, MessageMapper
from app.application.ports.repositories.conversation_repository import ConversationRepository
from app.domain.entities.conversation import Conversation, Message
from app.infrastructure.database.models.conversation import ConversationModel, MessageModel


class PostgresConversationRepository(ConversationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, workspace_id: str, conversation_id: str) -> Conversation | None:
        stmt = (
            select(ConversationModel)
            .where(ConversationModel.workspace_id == workspace_id, ConversationModel.id == conversation_id)
            .options(selectinload(ConversationModel.messages))
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return ConversationMapper.to_entity(model) if model else None

    async def get_by_phone(self, workspace_id: str, phone: str) -> Conversation | None:
        stmt = (
            select(ConversationModel)
            .where(ConversationModel.workspace_id == workspace_id, ConversationModel.phone == phone)
            .options(selectinload(ConversationModel.messages))
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return ConversationMapper.to_entity(model) if model else None

    async def create(self, workspace_id: str, conversation: Conversation) -> Conversation:
        model = ConversationMapper.to_model(conversation)
        self._session.add(model)
        await self._session.flush()
        return ConversationMapper.to_entity(model)

    async def append_message(
        self, workspace_id: str, conversation_id: str, message: Message
    ) -> None:
        model = await self._session.get(ConversationModel, conversation_id)
        if model is None or model.workspace_id != workspace_id:
            raise ValueError(f"Conversation {conversation_id} no encontrada en workspace {workspace_id}")
        message_model = MessageMapper.to_model(message, conversation_id)
        self._session.add(message_model)
        await self._session.flush()

    async def list_by_workspace(
        self, workspace_id: str, assigned_to_human: bool | None = None
    ) -> Sequence[Conversation]:
        stmt = select(ConversationModel).where(ConversationModel.workspace_id == workspace_id).options(
            selectinload(ConversationModel.messages)
        )
        if assigned_to_human is not None:
            stmt = stmt.where(ConversationModel.is_transferred_to_human == assigned_to_human)
        result = await self._session.execute(stmt)
        return [ConversationMapper.to_entity(m) for m in result.scalars().all()]

    async def mark_transferred_to_human(self, workspace_id: str, conversation_id: str) -> None:
        model = await self._session.get(ConversationModel, conversation_id)
        if model is not None and model.workspace_id == workspace_id:
            model.is_transferred_to_human = True
            await self._session.flush()
