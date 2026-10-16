"""
Job ARQ: búsqueda de negocios en segundo plano.

1. searching  — el scraper de Google Maps busca los negocios (puede tardar minutos).
2. importing  — se deduplican, enriquecen (WhatsApp, redes, directorios) y puntúan.
3. auditing   — se auditan en paralelo los sitios propios, se recalcula el puntaje y Jarvis
                escribe los mensajes de los leads de alta oportunidad (bandeja de aprobación).

El estado queda en `lead_import_jobs` para que la interfaz muestre el progreso.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from app.application.dto.lead_dto import ImportLeadsRequest
from app.application.services.website_audit_service import WebsiteAuditError, WebsiteAuditService
from app.application.use_cases.audit_lead_website import AuditLeadWebsiteUseCase
from app.application.use_cases.import_leads_from_scraper import ImportLeadsFromScraperUseCase
from app.infrastructure.database.models.lead import LeadImportJobModel
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.dependencies.providers import get_event_bus, get_scraper_provider
from app.infrastructure.repositories.postgres_lead_repository import PostgresLeadRepository
from app.infrastructure.workers.jobs.enrich_imported_leads_job import enrich_imported_leads

logger = logging.getLogger(__name__)

MAX_AUDITS_PER_JOB = 60


async def _update(job_id: str, **values) -> None:
    async with AsyncSessionLocal() as session:
        job = await session.get(LeadImportJobModel, job_id)
        if job is None:
            return
        for key, value in values.items():
            setattr(job, key, value)
        await session.commit()


def friendly_scraper_error(exc: Exception) -> str:
    if isinstance(exc, httpx.ConnectError):
        return "No se pudo conectar con el buscador de Google Maps. Revisa que el servicio esté encendido."
    if isinstance(exc, httpx.HTTPError):
        return "El buscador de Google Maps respondió con un error. Vuelve a intentarlo en unos minutos."
    if isinstance(exc, RuntimeError) and "timed out" in str(exc):
        return "La búsqueda tardó demasiado. Prueba con menos resultados o una zona más específica."
    return "La búsqueda falló. Vuelve a intentarlo."


async def audit_websites(workspace_id: str, lead_ids: list[str]) -> int:
    """Audita el sitio de cada lead (máximo MAX_AUDITS_PER_JOB) y recalcula su puntaje."""
    audited = 0
    async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
        audit_service = WebsiteAuditService(client)
        for lead_id in lead_ids[:MAX_AUDITS_PER_JOB]:
            async with AsyncSessionLocal() as session:
                try:
                    await AuditLeadWebsiteUseCase(PostgresLeadRepository(session), session, audit_service).execute(
                        workspace_id, lead_id
                    )
                    await session.commit()
                    audited += 1
                except (WebsiteAuditError, httpx.HTTPError, ValueError) as exc:
                    logger.info("Audit skipped for lead %s: %s", lead_id, exc)
                    await session.rollback()
                except Exception:  # noqa: BLE001 — un sitio raro no debe frenar la búsqueda
                    logger.exception("Unexpected error auditing lead %s", lead_id)
                    await session.rollback()
    return audited


async def audit_leads_job(ctx, payload: dict) -> dict:
    """Job ARQ: audita sitios de leads existentes (p. ej., tras «Actualizar datos»)."""
    audited = await audit_websites(payload["workspace_id"], list(payload["lead_ids"]))
    return {"workspace_id": payload["workspace_id"], "audited": audited}


async def import_leads_job(ctx, payload: dict) -> dict:
    job_id = payload["job_id"]
    async with AsyncSessionLocal() as session:
        job = await session.get(LeadImportJobModel, job_id)
        if job is None:
            return {"job_id": job_id, "status": "missing"}
        request = ImportLeadsRequest(
            workspace_id=job.workspace_id,
            keyword=job.keyword,
            location=job.location,
            max_results=job.max_results,
            depth=job.depth,
            extract_emails=job.extract_emails,
            country=job.country,
        )

    await _update(job_id, status="running", stage="searching", started_at=datetime.now(timezone.utc), error=None)

    # 1–2. Buscar e importar (enriquecido y con puntaje inicial)
    try:
        async with AsyncSessionLocal() as session:
            use_case = ImportLeadsFromScraperUseCase(get_scraper_provider(), PostgresLeadRepository(session), get_event_bus())
            result = await use_case.execute(request)
            await session.commit()
    except Exception as exc:  # noqa: BLE001 — se informa a la persona y se registra el detalle
        logger.exception("Import job %s failed", job_id)
        await _update(job_id, status="failed", stage=None, error=friendly_scraper_error(exc), finished_at=datetime.now(timezone.utc))
        return {"job_id": job_id, "status": "failed"}

    imported = list(result.imported)
    await _update(
        job_id,
        stage="auditing",
        found=len(imported) + result.skipped_duplicates,
        imported=len(imported),
        skipped=result.skipped_duplicates,
    )

    # 3. Auditar sitios, recalcular puntaje y redactar mensajes (una falla no detiene la búsqueda)
    enrichment: dict = {}
    if imported:
        try:
            enrichment = await enrich_imported_leads(ctx, {"workspace_id": request.workspace_id, "lead_ids": [lead.id for lead in imported]})
        except Exception:  # noqa: BLE001 — los leads ya quedaron guardados; la búsqueda cuenta como lista
            logger.exception("Enrichment failed for import job %s", job_id)

    await _update(job_id, status="done", stage=None, finished_at=datetime.now(timezone.utc))
    return {
        "job_id": job_id,
        "status": "done",
        "imported": len(imported),
        "audited": enrichment.get("audited_count", 0),
        "drafted": enrichment.get("drafted_count", 0),
    }
