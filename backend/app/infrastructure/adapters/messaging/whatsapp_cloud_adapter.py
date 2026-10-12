"""
Adapter: WhatsApp Business Cloud API (oficial de Meta).

Envío:
- Texto libre: solo dentro de las 24 h siguientes al último mensaje del cliente.
- Primer contacto (fuera de esa ventana): Meta exige una PLANTILLA aprobada. Si se
  configura WHATSAPP_CLOUD_TEMPLATE, los envíos iniciados por Jarvis la usan con el
  nombre del negocio como primer parámetro.

Recepción: webhook /api/v1/whatsapp/cloud/webhook (verificación con verify token y
firma X-Hub-Signature-256 con el app secret).
Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
"""
from __future__ import annotations

import hashlib
import hmac
import re
from typing import Any, Awaitable, Callable

import httpx

from app.application.ports.messaging_provider import InboundMessage, MessagingProvider, OutboundMessage
from app.infrastructure.config.config import get_settings

GRAPH_URL = "https://graph.facebook.com"


class WhatsAppCloudApiError(RuntimeError):
    pass


class WhatsAppCloudApiAdapter(MessagingProvider):
    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        if not settings.whatsapp_cloud_token or not settings.whatsapp_cloud_phone_number_id:
            raise WhatsAppCloudApiError(
                "Falta configurar WHATSAPP_CLOUD_TOKEN y WHATSAPP_CLOUD_PHONE_NUMBER_ID para usar la API oficial."
            )
        self._phone_number_id = settings.whatsapp_cloud_phone_number_id
        self._version = settings.whatsapp_cloud_api_version
        self._template = getattr(settings, "whatsapp_cloud_template", "")
        self._template_lang = getattr(settings, "whatsapp_cloud_template_lang", "es")
        self._client = http_client or httpx.AsyncClient(
            base_url=GRAPH_URL,
            headers={"Authorization": f"Bearer {settings.whatsapp_cloud_token}"},
            timeout=30.0,
        )

    @staticmethod
    def _to(phone: str) -> str:
        return re.sub(r"\D", "", phone)

    async def _post(self, body: dict[str, Any]) -> str:
        response = await self._client.post(f"/{self._version}/{self._phone_number_id}/messages", json=body)
        if response.status_code >= 400:
            detail = response.json().get("error", {}).get("message", response.text) if response.content else ""
            raise WhatsAppCloudApiError(f"WhatsApp Cloud API respondió {response.status_code}: {detail}")
        data = response.json()
        return (data.get("messages") or [{}])[0].get("id", "")

    async def send_message(self, message: OutboundMessage) -> str:
        """Texto libre (válido dentro de la ventana de 24 h de conversación)."""
        return await self._post(
            {
                "messaging_product": "whatsapp",
                "to": self._to(message.to_phone),
                "type": "text",
                "text": {"preview_url": False, "body": message.text},
            }
        )

    async def send_template(self, to_phone: str, parameters: list[str]) -> str:
        """Primer contacto con la plantilla aprobada (WHATSAPP_CLOUD_TEMPLATE)."""
        if not self._template:
            raise WhatsAppCloudApiError("Configura WHATSAPP_CLOUD_TEMPLATE (plantilla aprobada por Meta) para el primer contacto.")
        return await self._post(
            {
                "messaging_product": "whatsapp",
                "to": self._to(to_phone),
                "type": "template",
                "template": {
                    "name": self._template,
                    "language": {"code": self._template_lang},
                    "components": [
                        {"type": "body", "parameters": [{"type": "text", "text": value} for value in parameters]}
                    ],
                },
            }
        )

    async def register_webhook_handler(self, handler: Callable[[InboundMessage], Awaitable[None]]) -> None:
        # Los mensajes entrantes llegan por el webhook HTTP (router de WhatsApp).
        return None

    async def get_session_status(self, tenant_id: str) -> str:
        response = await self._client.get(f"/{self._version}/{self._phone_number_id}", params={"fields": "display_phone_number,quality_rating"})
        return "connected" if response.status_code == 200 else "disconnected"


def verify_signature(raw_body: bytes, signature_header: str | None, app_secret: str) -> bool:
    """Valida X-Hub-Signature-256 = 'sha256=' + HMAC-SHA256(cuerpo, app secret)."""
    if not app_secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature_header[7:], expected)


def parse_inbound(payload: dict[str, Any]) -> list[tuple[str, str]]:
    """Extrae (teléfono, texto) de los mensajes de texto entrantes del webhook de Meta."""
    found: list[tuple[str, str]] = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []) or []:
                text = (message.get("text") or {}).get("body") or (message.get("button") or {}).get("text") or ""
                if message.get("from") and text:
                    found.append((message["from"], text))
    return found


class AssistedMessagingAdapter(MessagingProvider):
    """
    Modo asistido: Jarvis NO envía mensajes por su cuenta. Prepara la lista diaria y el
    mensaje, y la persona lo envía desde su WhatsApp con un toque (sin riesgo de bloqueo).
    """

    async def send_message(self, message: OutboundMessage) -> str:
        raise WhatsAppCloudApiError(
            "Jarvis está en modo asistido: los mensajes se envían desde «Contactar hoy». "
            "Para envíos automáticos configura la API oficial (WHATSAPP_PROVIDER=cloud_api)."
        )

    async def register_webhook_handler(self, handler: Callable[[InboundMessage], Awaitable[None]]) -> None:
        return None

    async def get_session_status(self, tenant_id: str) -> str:
        return "assisted"
