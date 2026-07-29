"""
Router: /api/v1/workspaces/{workspace_id}/ai

Endpoint de utilidad para probar el prompt/base de conocimiento del agente antes de
conectarlo a un canal real (WhatsApp). No reemplaza el flujo real, que vive en
ProcessIncomingWhatsAppMessageUseCase.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.ports.ai_provider import AIProvider, ChatContext
from app.infrastructure.dependencies import get_ai_provider, require_workspace_access

from .schemas import TestAgentReplyBody, TestAgentReplyResponse

router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]


@router.post("/test-reply", response_model=TestAgentReplyResponse)
async def test_agent_reply(
    workspace_id: WorkspaceId,
    body: TestAgentReplyBody,
    ai_provider: Annotated[AIProvider, Depends(get_ai_provider)],
) -> TestAgentReplyResponse:
    response = await ai_provider.generate_chat_reply(
        ChatContext(
            conversation_history=body.conversation_history,
            knowledge_base=body.knowledge_base,
            tenant_id=workspace_id,
        ),
        body.message,
    )
    return TestAgentReplyResponse(
        reply=response.reply,
        should_transfer_to_human=response.should_transfer_to_human,
        detected_intent=response.detected_intent,
    )
