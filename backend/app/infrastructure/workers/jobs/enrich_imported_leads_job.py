"""
Job: enrich_imported_leads — tras una importación audita en paralelo los sitios web de los
leads nuevos y recalcula su score de oportunidad. Un sitio que no responde se registra como
caído, que es en sí mismo una señal de venta.
"""
from __future__ import annotations

import asyncio
import logging

from app.application.dto.lead_scoring_dto import RecalculateLeadScoreRequest, WebAuditInput
from app.application.dto.website_audit_dto import WebsiteAuditResult
from app.application.services.outreach_service import OutreachService
from app.application.services.website_audit_service import WebsiteAuditError, WebsiteAuditService
from app.application.use_cases.audit_lead_website import AuditLeadWebsiteUseCase
from app.application.use_cases.recalculate_lead_score import RecalculateLeadScoreUseCase
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.repositories.postgres_lead_repository import PostgresLeadRepository

logger = logging.getLogger(__name__)

MAX_CONCURRENT_AUDITS = 10


async def enrich_imported_leads(ctx, payload: dict) -> dict:
    workspace_id = payload["workspace_id"]
    lead_ids = payload["lead_ids"]
    min_score = payload.get("min_score")  # None → el mínimo configurado en el workspace
    audit_service = WebsiteAuditService()

    async with AsyncSessionLocal() as session:
        repository = PostgresLeadRepository(session)
        leads = [lead for lead_id in lead_ids if (lead := await repository.get_by_id(workspace_id, lead_id))]

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_AUDITS)

    async def audit(url: str) -> WebsiteAuditResult | None:
        async with semaphore:
            try:
                return await audit_service.audit(url)
            except WebsiteAuditError as exc:
                logger.info("Sitio %s no auditable: %s", url, exc)
                return None

    audits = await asyncio.gather(*(audit(lead.website) if lead.website else asyncio.sleep(0) for lead in leads))

    audited = 0
    failed: list[str] = []
    for lead, audit_result in zip(leads, audits):
        # Sesión por lead: un error puntual no revierte el enriquecimiento del resto
        async with AsyncSessionLocal() as session:
            repository = PostgresLeadRepository(session)
            try:
                if audit_result is not None:
                    await AuditLeadWebsiteUseCase(repository, session, audit_service).execute(
                        workspace_id, lead.id, prefetched_result=audit_result
                    )
                    audited += 1
                elif lead.website:
                    await RecalculateLeadScoreUseCase(repository, session).execute(
                        workspace_id, lead.id, RecalculateLeadScoreRequest(audit=WebAuditInput(website_reachable=False))
                    )
                else:
                    await RecalculateLeadScoreUseCase(repository, session).execute(workspace_id, lead.id)
                await session.commit()
            except Exception:
                logger.exception("No se pudo enriquecer el lead %s", lead.id)
                await session.rollback()
                failed.append(lead.id)

    # Los leads de alta oportunidad con WhatsApp quedan con su mensaje listo para aprobar
    scored_ids = [lead.id for lead in leads if lead.id not in failed]
    async with AsyncSessionLocal() as session:
        drafts = await OutreachService(session, PostgresLeadRepository(session)).draft_first_touch(
            workspace_id, scored_ids, min_score
        )
        await session.commit()

    return {
        "workspace_id": workspace_id,
        "processed_count": len(scored_ids),
        "audited_count": audited,
        "drafted_count": len(drafts),
        "failed_lead_ids": failed,
    }
