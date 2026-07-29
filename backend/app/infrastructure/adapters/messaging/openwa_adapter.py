"""
Adapter: OpenWAAdapter — implementa MessagingProvider contra un servidor OpenWA
(@open-wa/wa-automate) expuesto vía REST. Diseñado para poder reemplazarse por la API
oficial de WhatsApp Cloud sin que el resto del sistema lo note.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable

import httpx

from app.application.ports.messaging_provider import (
    InboundMessage,
    MessagingProvider,
    OutboundMessage,
)
from app.infrastructure.config.config import get_settings


class OpenWAAdapter(MessagingProvider):
    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self._base_url = settings.openwa_base_url.rstrip("/")
        self._api_key = settings.openwa_api_key
        self._client = http_client or httpx.AsyncClient(
            base_url=self._base_url, headers={"Authorization": f"Bearer {self._api_key}"}, timeout=30.0
        )
        self._webhook_handler: Callable[[InboundMessage], Awaitable[None]] | None = None

    async def send_message(self, message: OutboundMessage) -> str:
        text = message.text
        if message.template_variables:
            for key, value in message.template_variables.items():
                text = text.replace(f"{{{{{key}}}}}", value)

        response = await self._client.post(
            "/send-text",
            json={"chatId": f"{message.to_phone}@c.us", "content": text, "session": message.tenant_id},
        )
        response.raise_for_status()
        data: dict[str, Any] = response.json()
        return data.get("id", "")

    async def register_webhook_handler(
        self, handler: Callable[[InboundMessage], Awaitable[None]]
    ) -> None:
        """
        En OpenWA, el webhook lo dispara el propio servidor Node hacia un endpoint nuestro
        (infrastructure/api/v1/whatsapp/router.py), que a su vez invocará este handler
        registrado. Aquí sólo guardamos la referencia.
        """
        self._webhook_handler = handler

    async def handle_incoming_webhook(self, payload: dict[str, Any]) -> None:
        if self._webhook_handler is None:
            return
        message = InboundMessage(
            tenant_id=payload.get("session", ""),
            from_phone=payload.get("from", "").replace("@c.us", ""),
            text=payload.get("body", ""),
            raw_payload=payload,
        )
        await self._webhook_handler(message)

    async def get_session_status(self, tenant_id: str) -> str:
        response = await self._client.get(f"/session/{tenant_id}/status")
        if response.status_code == 404:
            return "disconnected"
        response.raise_for_status()
        return response.json().get("status", "disconnected")
