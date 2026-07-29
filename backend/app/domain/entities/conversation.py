"""
Entidades: Conversation + Message (memoria por conversación, WhatsApp).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class MessageDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageSender(str, Enum):
    LEAD = "lead"
    AI_AGENT = "ai_agent"
    HUMAN_AGENT = "human_agent"


@dataclass
class Message:
    direction: MessageDirection
    sender: MessageSender
    text: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    sent_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Conversation:
    workspace_id: str
    lead_id: str
    phone: str
    messages: list[Message] = field(default_factory=list)
    is_transferred_to_human: bool = False
    assigned_human_user_id: str | None = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def add_message(self, message: Message) -> None:
        self.messages.append(message)

    def transfer_to_human(self, user_id: str | None = None) -> None:
        self.is_transferred_to_human = True
        self.assigned_human_user_id = user_id

    @property
    def last_message(self) -> Message | None:
        return self.messages[-1] if self.messages else None
