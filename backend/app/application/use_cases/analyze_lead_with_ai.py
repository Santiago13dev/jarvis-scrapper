"""
Caso de uso: AnalyzeLeadWithAIUseCase.

Analiza un lead con IA (criterios: presencia digital, reseñas, fotos, horarios, etc.),
aplica el LeadScore resultante y publica LeadAnalyzedEvent.
"""
from __future__ import annotations

from app.application.dto.lead_dto import AnalyzeLeadRequest
from app.application.ports.ai_provider import AIProvider, BusinessAnalysisInput
from app.application.ports.event_bus import EventBus
from app.application.ports.repositories.lead_repository import LeadRepository
from app.domain.entities.lead import Lead
from app.domain.events.domain_events import LeadAnalyzedEvent
from app.domain.value_objects.lead_score import LeadScore


class AnalyzeLeadWithAIUseCase:
    def __init__(
        self,
        ai_provider: AIProvider,
        lead_repository: LeadRepository,
        event_bus: EventBus,
    ) -> None:
        self._ai = ai_provider
        self._leads = lead_repository
        self._event_bus = event_bus

    async def execute(self, request: AnalyzeLeadRequest) -> Lead:
        lead = await self._leads.get_by_id(request.workspace_id, request.lead_id)
        if lead is None:
            raise ValueError(f"Lead {request.lead_id} no encontrado en workspace {request.workspace_id}")

        analysis_input = BusinessAnalysisInput(
            name=lead.name,
            has_website=bool(lead.website),
            has_email=bool(lead.email),
            has_whatsapp=bool(lead.whatsapp),
            has_instagram=bool(lead.instagram),
            has_facebook=bool(lead.facebook),
            reviews_count=lead.reviews_count or 0,
            photos_count=lead.photos_count or 0,
            has_business_hours=False,  # TODO: incluir horarios cuando el scraper los entregue
            description=None,
        )

        result = await self._ai.analyze_business(analysis_input)

        lead.apply_ai_score(
            LeadScore(value=result.lead_score, summary=result.summary, detected_gaps=tuple(result.detected_gaps))
        )

        updated_lead = await self._leads.update(request.workspace_id, lead)

        await self._event_bus.publish(
            LeadAnalyzedEvent(
                workspace_id=request.workspace_id,
                lead_id=updated_lead.id,
                lead_score=result.lead_score,
            )
        )

        return updated_lead
