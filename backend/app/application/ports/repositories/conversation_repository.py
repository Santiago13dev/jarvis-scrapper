"""
Port: ConversationRepository
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Sequence

if TYPE_CHECKING:
    from app.domain.entities.conversation import Conversation, Message


class ConversationRepository(ABC):

    @abstractmethod
    async def get_by_id(self, workspace_id: str, conversation_id: str) -> "Conversation | None":
        raise NotImplementedError

    @abstractmethod
    async def get_by_phone(self, workspace_id: str, phone: str) -> "Conversation | None":
        raise NotImplementedError

    @abstractmethod
    async def create(self, workspace_id: str, conversation: "Conversation") -> "Conversation":
        raise NotImplementedError

    @abstractmethod
    async def append_message(
        self, workspace_id: str, conversation_id: str, message: "Message"
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def list_by_workspace(
        self, workspace_id: str, assigned_to_human: bool | None = None
    ) -> Sequence["Conversation"]:
        raise NotImplementedError

    @abstractmethod
    async def mark_transferred_to_human(self, workspace_id: str, conversation_id: str) -> None:
        raise NotImplementedError
