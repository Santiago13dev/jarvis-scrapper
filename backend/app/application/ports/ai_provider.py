"""
Port: AIProvider

Contrato para cualquier proveedor de inteligencia artificial (OpenAI, Anthropic, modelos
locales, etc). La lógica de negocio nunca invoca al SDK del proveedor directamente.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class BusinessAnalysisInput:
    """Datos normalizados de una empresa, listos para ser analizados por la IA."""
    name: str
    has_website: bool
    has_email: bool
    has_whatsapp: bool
    has_instagram: bool
    has_facebook: bool
    reviews_count: int
    photos_count: int
    has_business_hours: bool
    description: str | None


@dataclass(frozen=True)
class BusinessAnalysisResult:
    lead_score: int  # 0-100
    summary: str  # por qué representa una oportunidad comercial
    detected_gaps: list[str]  # ej: ["sin sitio web", "pocas reseñas"]


@dataclass(frozen=True)
class ChatContext:
    """Historial + base de conocimiento configurable para el agente conversacional."""
    conversation_history: list[dict]  # [{"role": "user"|"assistant", "content": str}]
    knowledge_base: str  # contexto/base de conocimiento del tenant, nunca se inventa info fuera de esto
    tenant_id: str


@dataclass(frozen=True)
class ChatResponse:
    reply: str
    should_transfer_to_human: bool
    detected_intent: str | None


class AIProvider(ABC):
    """Puerto que abstrae el motor de inteligencia artificial."""

    @abstractmethod
    async def analyze_business(self, data: BusinessAnalysisInput) -> BusinessAnalysisResult:
        """Genera Lead Score (0-100) y resumen de oportunidad comercial."""
        raise NotImplementedError

    @abstractmethod
    async def generate_chat_reply(self, context: ChatContext, incoming_message: str) -> ChatResponse:
        """Responde usando únicamente la base de conocimiento del tenant. Nunca inventa datos."""
        raise NotImplementedError

    @abstractmethod
    async def summarize_conversation(self, conversation_history: list[dict]) -> str:
        raise NotImplementedError
