"""
DTOs para exportaciones y para el flujo conversacional de WhatsApp.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.application.ports.file_storage_provider import ExportFormat


@dataclass(frozen=True)
class ExportLeadsRequest:
    workspace_id: str
    lead_ids: list[str]
    fmt: ExportFormat


@dataclass(frozen=True)
class ExportLeadsResult:
    file_url: str
    total_exported: int


@dataclass(frozen=True)
class IncomingWhatsAppMessageRequest:
    workspace_id: str
    from_phone: str
    text: str


@dataclass(frozen=True)
class TransferConversationRequest:
    workspace_id: str
    conversation_id: str
    reason: str
