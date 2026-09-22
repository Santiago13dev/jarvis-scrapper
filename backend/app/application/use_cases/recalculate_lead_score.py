from __future__ import annotations

from datetime import timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.lead_scoring_dto import (
    LeadScoringResult,
    LeadScoringWeights,
    RecalculateLeadScoreRequest,
    WebAuditInput,
)
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.services.lead_scoring_service import LeadScoringService
from app.domain.entities.web_audit import WebAudit
from app.infrastructure.database.models.lead import LeadScoringConfigModel, WebAuditModel


class RecalculateLeadScoreUseCase:
    def __init__(
        self,
        lead_repository: LeadRepository,
        session: AsyncSession,
        scoring_service: LeadScoringService | None = None,
    ) -> None:
        self._leads = lead_repository
        self._session = session
        self._scoring = scoring_service or LeadScoringService()

    async def execute(
        self,
        workspace_id: str,
        lead_id: str,
        request: RecalculateLeadScoreRequest | None = None,
    ) -> LeadScoringResult:
        request = request or RecalculateLeadScoreRequest()
        lead = await self._leads.get_by_id(workspace_id, lead_id)
        if lead is None:
            raise ValueError(f"Lead {lead_id} no encontrado en workspace {workspace_id}")

        audit_model = await self._get_audit(lead_id)
        if request.audit is not None:
            was_missing = audit_model is None
            audit_model = self._upsert_audit(audit_model, lead_id, request.audit)
            if was_missing:
                self._session.add(audit_model)
            await self._session.flush()
        audit = self._to_audit(audit_model, lead_id)

        weights = request.weights
        config = await self._session.get(LeadScoringConfigModel, request.niche)
        if weights is not None:
            weights_dict = weights.model_dump()
            if config is None:
                config = LeadScoringConfigModel(niche=request.niche, weights=weights_dict)
                self._session.add(config)
            else:
                config.weights = weights_dict
            await self._session.flush()
        elif config is not None:
            weights = LeadScoringWeights(**config.weights)

        result = self._scoring.calculate(lead, audit, weights, request.niche)
        lead.apply_deterministic_score(result)
        await self._leads.update(workspace_id, lead)
        return result

    async def _get_audit(self, lead_id: str) -> WebAuditModel | None:
        result = await self._session.execute(
            select(WebAuditModel).where(WebAuditModel.lead_id == lead_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _upsert_audit(
        model: WebAuditModel | None, lead_id: str, audit: WebAuditInput
    ) -> WebAuditModel:
        values = audit.model_dump(exclude_none=True)
        values["audited_at"] = audit.audited_at
        if model is None:
            model = WebAuditModel(lead_id=lead_id)
        for key, value in values.items():
            if key == "audited_at" and value is None:
                continue
            setattr(model, key, value)
        return model

    @staticmethod
    def _to_audit(model: WebAuditModel | None, lead_id: str) -> WebAudit:
        if model is None:
            return WebAudit(lead_id=lead_id)
        audited_at = model.audited_at
        if audited_at.tzinfo is None:
            audited_at = audited_at.replace(tzinfo=timezone.utc)
        return WebAudit(
            lead_id=lead_id,
            website_reachable=model.website_reachable,
            https_enabled=model.https_enabled,
            has_title=model.has_title,
            has_meta_description=model.has_meta_description,
            mobile_friendly=model.mobile_friendly,
            load_time_ms=model.load_time_ms,
            audited_at=audited_at,
        )
