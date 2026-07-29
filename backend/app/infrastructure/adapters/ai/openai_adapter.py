"""
Adapter: OpenAIAdapter — implementa AIProvider usando el SDK de OpenAI.

Regla de negocio respetada aquí (no en el prompt del modelo únicamente): el system
prompt fuerza a no responder fuera de la base de conocimiento del tenant.
"""
from __future__ import annotations

import json

from openai import AsyncOpenAI

from app.application.ports.ai_provider import (
    AIProvider,
    BusinessAnalysisInput,
    BusinessAnalysisResult,
    ChatContext,
    ChatResponse,
)
from app.infrastructure.config.config import get_settings

_ANALYSIS_SYSTEM_PROMPT = """Eres un analista comercial. Evalúas la presencia digital de un \
negocio local y devuelves EXCLUSIVAMENTE un JSON con las claves: lead_score (0-100, entero), \
summary (string, por qué es una oportunidad comercial) y detected_gaps (lista de strings, \
carencias detectadas: ej. "sin sitio web", "pocas reseñas"). No agregues texto fuera del JSON."""

_CHAT_SYSTEM_PROMPT_TEMPLATE = """Eres el agente de atención de {workspace}. Respondes SOLO con \
información presente en esta base de conocimiento. Si la pregunta no puede responderse con ella, \
indica que vas a transferir con un humano y marca should_transfer=true. Nunca inventes datos.

BASE DE CONOCIMIENTO:
{knowledge_base}

Responde EXCLUSIVAMENTE en JSON con las claves: reply (string), should_transfer (bool), \
detected_intent (string o null)."""


class OpenAIAdapter(AIProvider):
    def __init__(self, client: AsyncOpenAI | None = None) -> None:
        settings = get_settings()
        self._client = client or AsyncOpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_model

    async def analyze_business(self, data: BusinessAnalysisInput) -> BusinessAnalysisResult:
        response = await self._client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(data.__dict__, ensure_ascii=False)},
            ],
        )
        parsed = json.loads(response.choices[0].message.content)
        return BusinessAnalysisResult(
            lead_score=int(parsed["lead_score"]),
            summary=parsed["summary"],
            detected_gaps=list(parsed.get("detected_gaps", [])),
        )

    async def generate_chat_reply(self, context: ChatContext, incoming_message: str) -> ChatResponse:
        system_prompt = _CHAT_SYSTEM_PROMPT_TEMPLATE.format(
            workspace=context.tenant_id, knowledge_base=context.knowledge_base
        )
        messages = [{"role": "system", "content": system_prompt}, *context.conversation_history]
        messages.append({"role": "user", "content": incoming_message})

        response = await self._client.chat.completions.create(
            model=self._model, response_format={"type": "json_object"}, messages=messages
        )
        parsed = json.loads(response.choices[0].message.content)
        return ChatResponse(
            reply=parsed["reply"],
            should_transfer_to_human=bool(parsed.get("should_transfer", False)),
            detected_intent=parsed.get("detected_intent"),
        )

    async def summarize_conversation(self, conversation_history: list[dict]) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": "Resume la conversación en 2-3 frases, en español."},
                {"role": "user", "content": json.dumps(conversation_history, ensure_ascii=False)},
            ],
        )
        return response.choices[0].message.content or ""
