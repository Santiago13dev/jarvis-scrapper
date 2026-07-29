"""
Caso de uso: SendCampaignMessagesUseCase.

Ejecutado por el worker de ARQ (ver infrastructure/workers/jobs/) cuando una campaña
pasa a RUNNING. Por cada lead: renderiza la plantilla, envía por MessagingProvider,
crea/actualiza la Conversation con el mensaje saliente.
"""
from __future__ import annotations

from app.application.ports.messaging_provider import MessagingProvider, OutboundMessage
from app.application.ports.repositories.campaign_repository import CampaignRepository
from app.application.ports.repositories.conversation_repository import ConversationRepository
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.ports.repositories.template_repository import TemplateRepository
from app.domain.entities.conversation import Conversation, Message, MessageDirection, MessageSender


class SendCampaignMessagesUseCase:
    def __init__(
        self,
        campaign_repository: CampaignRepository,
        lead_repository: LeadRepository,
        template_repository: TemplateRepository,
        conversation_repository: ConversationRepository,
        messaging_provider: MessagingProvider,
    ) -> None:
        self._campaigns = campaign_repository
        self._leads = lead_repository
        self._templates = template_repository
        self._conversations = conversation_repository
        self._messaging = messaging_provider

    async def execute(self, workspace_id: str, campaign_id: str) -> int:
        campaign = await self._campaigns.get_by_id(workspace_id, campaign_id)
        if campaign is None:
            raise ValueError(f"Campaign {campaign_id} no encontrada")

        templates = await self._templates.list_message_templates(workspace_id)
        template = next((t for t in templates if t.id == campaign.message_template_id), None)
        if template is None:
            raise ValueError(f"MessageTemplate {campaign.message_template_id} no encontrado")

        sent_count = 0
        for lead_id in campaign.lead_ids:
            lead = await self._leads.get_by_id(workspace_id, lead_id)
            if lead is None or not lead.whatsapp and not lead.phone:
                continue

            phone = lead.whatsapp or lead.phone
            rendered_text = template.render({"lead_name": lead.name})

            await self._messaging.send_message(
                OutboundMessage(tenant_id=workspace_id, to_phone=phone, text=rendered_text)
            )

            conversation = await self._conversations.get_by_phone(workspace_id, phone)
            if conversation is None:
                conversation = Conversation(workspace_id=workspace_id, lead_id=lead.id, phone=phone)
                conversation = await self._conversations.create(workspace_id, conversation)

            await self._conversations.append_message(
                workspace_id,
                conversation.id,
                Message(
                    direction=MessageDirection.OUTBOUND,
                    sender=MessageSender.AI_AGENT,
                    text=rendered_text,
                ),
            )
            sent_count += 1

        return sent_count
