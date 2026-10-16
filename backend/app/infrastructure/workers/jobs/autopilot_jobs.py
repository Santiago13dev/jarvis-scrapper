"""
Jobs del piloto automático:
- autopilot_tick (cron): encola las reglas activas cuya próxima ejecución ya llegó.
- run_autopilot_rule: busca cada rubro × ciudad, enriquece/puntúa los leads nuevos y redacta
  mensajes para los de alta oportunidad, que quedan esperando aprobación.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select, update

from app.application.dto.lead_dto import ImportLeadsRequest
from app.application.use_cases.import_leads_from_scraper import ImportLeadsFromScraperUseCase
from app.infrastructure.adapters.event_bus.in_memory_event_bus import InMemoryEventBus
from app.infrastructure.adapters.scraper.google_maps_adapter import GoogleMapsScraperAdapter
from app.infrastructure.database.models.automation import AutopilotRuleModel
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.repositories.postgres_lead_repository import PostgresLeadRepository
from app.infrastructure.workers.jobs.enrich_imported_leads_job import enrich_imported_leads
from app.infrastructure.workers.jobs.import_leads_job import friendly_scraper_error

logger = logging.getLogger(__name__)


async def autopilot_tick(ctx) -> dict:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        due = (
            await session.execute(
                select(AutopilotRuleModel.id).where(
                    AutopilotRuleModel.is_active.is_(True),
                    AutopilotRuleModel.is_running.is_(False),
                    or_(AutopilotRuleModel.next_run_at.is_(None), AutopilotRuleModel.next_run_at <= now),
                )
            )
        ).scalars().all()
    for rule_id in due:
        # _job_id evita encolar dos veces la misma regla mientras la anterior sigue en cola
        await ctx["redis"].enqueue_job("run_autopilot_rule", {"rule_id": rule_id}, _job_id=f"autopilot:{rule_id}")
    return {"enqueued": len(due)}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _save_progress(rule_id: str, progress: dict) -> None:
    """Guarda el avance para que la interfaz muestre en qué búsqueda va y cuánto ha encontrado."""
    async with AsyncSessionLocal() as session:
        rule = await session.get(AutopilotRuleModel, rule_id)
        if rule is not None:
            rule.progress = dict(progress, searches=[dict(item) for item in progress["searches"]])
            await session.commit()


async def run_autopilot_rule(ctx, payload: dict) -> dict:
    rule_id = payload["rule_id"]
    async with AsyncSessionLocal() as session:
        rule = await session.get(AutopilotRuleModel, rule_id)
        if rule is None or rule.is_running:
            return {"rule_id": rule_id, "status": "skipped"}
        rule.is_running = True
        workspace_id, country, depth, min_score = rule.workspace_id, rule.country, rule.depth, rule.min_score
        searches = [(keyword, location) for keyword in rule.keywords for location in rule.locations]
        progress = {
            "started_at": _now_iso(),
            "stage": "searching",
            "current": 0,
            "new_leads": 0,
            "drafted": 0,
            "searches": [
                {"keyword": keyword, "location": location, "status": "pending", "new": 0, "duplicates": 0, "closed": 0, "error": None}
                for keyword, location in searches
            ],
        }
        rule.progress = progress
        await session.commit()

    new_lead_ids: list[str] = []
    errors: list[str] = []
    drafted = 0
    try:
        for index, (keyword, location) in enumerate(searches):
            item = progress["searches"][index]
            item.update(status="running", started_at=_now_iso())
            progress["current"] = index
            await _save_progress(rule_id, progress)
            try:
                async with AsyncSessionLocal() as session:
                    result = await ImportLeadsFromScraperUseCase(
                        GoogleMapsScraperAdapter(), PostgresLeadRepository(session), InMemoryEventBus()
                    ).execute(
                        ImportLeadsRequest(
                            workspace_id=workspace_id,
                            keyword=keyword,
                            location=location,
                            max_results=500,
                            depth=depth,
                            country=country,
                        )
                    )
                    await session.commit()
                    new_lead_ids.extend(lead.id for lead in result.imported)
                item.update(
                    status="done",
                    new=len(result.imported),
                    duplicates=result.skipped_duplicates,
                    closed=result.skipped_closed,
                    finished_at=_now_iso(),
                )
            except Exception as exc:
                logger.exception("Autopilot %s: falló la búsqueda '%s' en '%s'", rule_id, keyword, location)
                errors.append(f"{keyword} / {location}: {exc}"[:200])
                item.update(status="failed", error=friendly_scraper_error(exc), finished_at=_now_iso())
            progress["new_leads"] = len(new_lead_ids)
            await _save_progress(rule_id, progress)

        if new_lead_ids:
            progress.update(stage="enriching", current=len(searches))
            await _save_progress(rule_id, progress)
            enrichment = await enrich_imported_leads(
                ctx, {"workspace_id": workspace_id, "lead_ids": new_lead_ids, "min_score": min_score}
            )
            drafted = enrichment["drafted_count"]
    finally:
        async with AsyncSessionLocal() as session:
            rule = await session.get(AutopilotRuleModel, rule_id)
            if rule is not None:
                now = datetime.now(timezone.utc)
                rule.is_running = False
                rule.progress = None
                rule.last_run_at = now
                rule.next_run_at = now + timedelta(hours=rule.frequency_hours)
                rule.total_leads_found = (rule.total_leads_found or 0) + len(new_lead_ids)
                rule.last_result = {
                    "new_leads": len(new_lead_ids),
                    "drafted": drafted,
                    "searches": len(searches),
                    "errors": errors,
                    "started_at": progress["started_at"],
                    "finished_at": now.isoformat(),
                    "breakdown": progress["searches"],
                }
                await session.commit()

    return {"rule_id": rule_id, "new_leads": len(new_lead_ids), "errors": len(errors)}


async def reset_stuck_autopilot_rules(ctx) -> None:
    """Al arrancar el worker ninguna regla puede estar corriendo de verdad."""
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(AutopilotRuleModel).where(AutopilotRuleModel.is_running.is_(True)).values(is_running=False, progress=None)
        )
        await session.commit()
