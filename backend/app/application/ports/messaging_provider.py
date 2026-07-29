"""
Port: MessagingProvider

Contrato para el canal de mensajería. El adapter inicial usará OpenWA; en el futuro
podrá reemplazarse por la API oficial de WhatsApp Cloud sin tocar el resto del sistema.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, Awaitable


@dataclass(frozen=True)
class OutboundMessage:
    tenant_id: str
    to_phone: str
    text: str
    template_variables: dict[str, str] | None = None


@dataclass(frozen=True)
class InboundMessage:
    tenant_id: str
    from_phone: str
    text: str
    raw_payload: dict


class MessagingProvider(ABC):
    """Puerto que abstrae el canal de mensajería (WhatsApp u otro)."""

    @abstractmethod
    async def send_message(self, message: OutboundMessage) -> str:
        """Envía un mensaje y devuelve el id externo del mensaje enviado."""
        raise NotImplementedError

    @abstractmethod
    async def register_webhook_handler(
        self, handler: Callable[[InboundMessage], Awaitable[None]]
    ) -> None:
        """Registra el callback que procesará los mensajes entrantes."""
        raise NotImplementedError

    @abstractmethod
    async def get_session_status(self, tenant_id: str) -> str:
        """connected / disconnected / qr_pending / banned, etc."""
        raise NotImplementedError
