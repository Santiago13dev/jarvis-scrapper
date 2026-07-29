from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class OpenWAWebhookPayload(BaseModel):
    """Estructura mínima esperada del webhook de OpenWA. Se guarda raw además, por si
    el payload real trae más campos (distintas versiones de @open-wa/wa-automate)."""
    session: str
    from_: str | None = None
    body: str | None = None

    model_config = {"populate_by_name": True, "extra": "allow"}


class WhatsAppSessionStatusResponse(BaseModel):
    workspace_id: str
    status: str


class ConversationResponse(BaseModel):
    id: str
    workspace_id: str
    lead_id: str
    phone: str
    is_transferred_to_human: bool
    messages: list[dict[str, Any]]


class TransferConversationBody(BaseModel):
    reason: str = "manual_transfer"
