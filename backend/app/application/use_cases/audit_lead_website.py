from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.lead_scoring_dto import RecalculateLeadScoreRequest, WebAuditInput
from app.application.dto.website_audit_dto import WebsiteAuditResult
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.services.website_audit_service import WebsiteAuditService
from app.application.use_cases.recalculate_lead_score import RecalculateLeadScoreUseCase
from app.infrastructure.database.models.lead import WebAuditModel


class AuditLeadWebsiteUseCase:
    def __init__(
        self,
        lead_repository: LeadRepository,
        session: AsyncSession,
        audit_service: WebsiteAuditService,
    ) -> None:
        self._leads = lead_repository
        self._session = session
        self._audit_service = audit_service

    async def execute(self, workspace_id: str, lead_id: str, url: str | None = None) -> WebsiteAuditResult:
        lead = await self._leads.get_by_id(workspace_id, lead_id)
        if lead is None:
            raise ValueError(f"Lead {lead_id} no encontrado en workspace {workspace_id}")
        target_url = url or lead.website
        if not target_url:
            raise ValueError("El lead no tiene sitio web para auditar")

        audit_result = await self._audit_service.audit(target_url)
        model = await self._get_audit(lead_id)
        if model is None:
            model = WebAuditModel(lead_id=lead_id)
            self._session.add(model)
        model.website_reachable = audit_result.status_code is not None and audit_result.status_code < 400
        model.https_enabled = audit_result.https
        model.has_title = bool(audit_result.title)
        model.has_meta_description = bool(audit_result.meta_description)
        model.mobile_friendly = audit_result.meta_viewport
        model.load_time_ms = audit_result.response_time_ms
        model.result = audit_result.model_dump(mode="json")
        await self._session.flush()

        await RecalculateLeadScoreUseCase(self._leads, self._session).execute(
            workspace_id,
            lead_id,
            RecalculateLeadScoreRequest(
                audit=WebAuditInput(
                    website_reachable=model.website_reachable,
                    https_enabled=model.https_enabled,
                    has_title=model.has_title,
                    has_meta_description=model.has_meta_description,
                    mobile_friendly=model.mobile_friendly,
                    load_time_ms=model.load_time_ms,
                    audited_at=audit_result.audited_at,
                )
            ),
        )
        return audit_result

    async def _get_audit(self, lead_id: str) -> WebAuditModel | None:
        result = await self._session.execute(
            select(WebAuditModel).where(WebAuditModel.lead_id == lead_id)
        )
        return result.scalar_one_or_none()
