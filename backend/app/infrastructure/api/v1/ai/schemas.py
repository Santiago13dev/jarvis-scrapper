from __future__ import annotations

from pydantic import BaseModel


class TestAgentReplyBody(BaseModel):
    message: str
    knowledge_base: str
    conversation_history: list[dict] = []


class TestAgentReplyResponse(BaseModel):
    reply: str
    should_transfer_to_human: bool
    detected_intent: str | None
