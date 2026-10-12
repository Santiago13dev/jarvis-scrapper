"""
Router: /api/v1/workspaces/{workspace_id}/leads — automatizaciones de prospección.

Se monta ANTES del router de leads para que rutas como /import-jobs no se confundan
con /{lead_id}.

- Búsquedas en segundo plano con progreso (/import-jobs).
- «Actualizar datos»: enriquece y re-puntúa todos los leads, y audita sus sitios (/enrich).
- Lista diaria de contacto (/outreach-queue) y mensaje listo para WhatsApp (/{id}/outreach).
- Registro de contacto con seguimiento automático (/{id}/contacted).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.lead_scoring_dto import RecalculateLeadScoreRequest
from app.application.ports.queue_provider import QueueProvider
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.ports.repositories.template_repository import TemplateRepository
from app.application.services.follow_up_service import FollowUpService
from app.application.use_cases.recalculate_lead_score import RecalculateLeadScoreUseCase
from app.domain.entities.lead import Lead
from app.domain.services.lead_enrichment import apply_enrichment
from app.domain.services.outreach import DEFAULT_MESSAGE, is_contactable, priority, render_message, whatsapp_link
from app.infrastructure.database.models.lead import LeadImportJobModel, WebAuditModel
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import (
    CurrentUser,
    get_lead_repository,
    get_queue_provider,
    get_template_repository,
    require_workspace_access,
)

router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]
Session = Annotated[AsyncSession, Depends(get_db_session)]
Leads = Annotated[LeadRepository, Depends(get_lead_repository)]
Queue = Annotated[QueueProvider, Depends(get_queue_provider)]


# ---------- Búsquedas en segundo plano ----------

class ImportJobBody(BaseModel):
    keyword: str = Field(min_length=2, max_length=120)
    location: str = Field(min_length=2, max_length=120)
    max_results: int = Field(default=40, ge=5, le=300)
    depth: int = Field(default=1, ge=1, le=5)
    extract_emails: bool = False


class ImportJobResponse(BaseModel):
    id: str
    keyword: str
    location: str
    max_results: int
    extract_emails: bool
    status: str
    stage: str | None
    found: int
    imported: int
    skipped: int
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


def _job_response(job: LeadImportJobModel) -> ImportJobResponse:
    return ImportJobResponse(
        id=job.id,
        keyword=job.keyword,
        location=job.location,
        max_results=job.max_results,
        extract_emails=job.extract_emails,
        status=job.status,
        stage=job.stage,
        found=job.found,
        imported=job.imported,
        skipped=job.skipped,
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


STALE_AFTER = timedelta(minutes=40)


async def _expire_stale_jobs(session: AsyncSession, workspace_id: str) -> None:
    """Una búsqueda «en curso» por más de 40 min se da por fallida (p. ej., si el worker se reinició)."""
    cutoff = datetime.now(timezone.utc) - STALE_AFTER
    result = await session.execute(
        select(LeadImportJobModel).where(
            LeadImportJobModel.workspace_id == workspace_id,
            LeadImportJobModel.status.in_(("queued", "running")),
            LeadImportJobModel.created_at < cutoff,
        )
    )
    for job in result.scalars():
        job.status = "failed"
        job.stage = None
        job.error = "La búsqueda se interrumpió. Vuelve a intentarla."
        job.finished_at = datetime.now(timezone.utc)
    await session.flush()


@router.post("/import-jobs", response_model=ImportJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_import_job(workspace_id: WorkspaceId, body: ImportJobBody, user: CurrentUser, session: Session, queue: Queue):
    await _expire_stale_jobs(session, workspace_id)
    running = await session.scalar(
        select(LeadImportJobModel.id).where(
            LeadImportJobModel.workspace_id == workspace_id,
            LeadImportJobModel.status.in_(("queued", "running")),
        )
    )
    if running:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya hay una búsqueda en curso. Espera a que termine.")
    job = LeadImportJobModel(
        workspace_id=workspace_id,
        requested_by_user_id=user.id,
        keyword=body.keyword.strip(),
        location=body.location.strip(),
        max_results=body.max_results,
        depth=body.depth,
        extract_emails=body.extract_emails,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    await queue.enqueue("import_leads_job", {"job_id": job.id})
    return _job_response(job)


@router.get("/import-jobs", response_model=list[ImportJobResponse])
async def list_import_jobs(workspace_id: WorkspaceId, session: Session, limit: int = 8):
    await _expire_stale_jobs(session, workspace_id)
    await session.commit()
    result = await session.execute(
        select(LeadImportJobModel)
        .where(LeadImportJobModel.workspace_id == workspace_id)
        .order_by(desc(LeadImportJobModel.created_at))
        .limit(max(1, min(limit, 50)))
    )
    return [_job_response(job) for job in result.scalars()]


@router.get("/import-jobs/{job_id}", response_model=ImportJobResponse)
async def get_import_job(workspace_id: WorkspaceId, job_id: str, session: Session):
    job = await session.get(LeadImportJobModel, job_id)
    if job is None or job.workspace_id != workspace_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Búsqueda no encontrada")
    return _job_response(job)


# ---------- Actualizar datos de todos los leads ----------

class EnrichResult(BaseModel):
    processed: int
    with_whatsapp: int
    without_website: int
    audits_queued: int


@router.post("/enrich", response_model=EnrichResult)
async def enrich_all(workspace_id: WorkspaceId, session: Session, leads: Leads, queue: Queue):
    """Completa WhatsApp/redes, separa directorios y recalcula el puntaje de todos los leads."""
    all_leads = list(await leads.list_by_workspace(workspace_id, limit=10000))
    audited_ids = set(
        (await session.execute(select(WebAuditModel.lead_id).where(WebAuditModel.lead_id.in_([l.id for l in all_leads])))).scalars()
    ) if all_leads else set()
    rescore = RecalculateLeadScoreUseCase(leads, session)
    to_audit: list[str] = []
    for lead in all_leads:
        apply_enrichment(lead)
        await leads.update(workspace_id, lead)
        await rescore.execute(workspace_id, lead.id, RecalculateLeadScoreRequest())
        if lead.website and lead.id not in audited_ids:
            to_audit.append(lead.id)
    await session.commit()
    if to_audit:
        await queue.enqueue("audit_leads_job", {"workspace_id": workspace_id, "lead_ids": to_audit})
    return EnrichResult(
        processed=len(all_leads),
        with_whatsapp=sum(1 for lead in all_leads if lead.whatsapp),
        without_website=sum(1 for lead in all_leads if not lead.website),
        audits_queued=len(to_audit),
    )


# ---------- Contacto asistido ----------

class OutreachItem(BaseModel):
    lead_id: str
    name: str
    category: str | None
    address: str | None
    rating: float | None
    reviews_count: int | None
    lead_score: int | None
    score_level: str | None
    whatsapp: str
    instagram: str | None
    website: str | None
    status: str
    contact_attempts: int
    last_contacted_at: datetime | None
    message: str
    whatsapp_url: str


async def _template_content(templates: TemplateRepository, workspace_id: str, template_id: str | None) -> str:
    if not template_id:
        return DEFAULT_MESSAGE
    template = await templates.get_message_template(workspace_id, template_id)
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plantilla no encontrada")
    return template.content


def _outreach_item(lead: Lead, content: str) -> OutreachItem | None:
    message = render_message(content, lead)
    url = whatsapp_link(lead, message)
    if url is None:
        return None
    return OutreachItem(
        lead_id=lead.id,
        name=lead.name,
        category=lead.category,
        address=lead.address,
        rating=lead.rating,
        reviews_count=lead.reviews_count,
        lead_score=lead.score.value if lead.score else None,
        score_level=lead.score_level,
        whatsapp=lead.whatsapp or "",
        instagram=lead.instagram,
        website=lead.website,
        status=lead.status.value,
        contact_attempts=lead.contact_attempts,
        last_contacted_at=lead.last_contacted_at,
        message=message,
        whatsapp_url=url,
    )


@router.get("/outreach-queue", response_model=list[OutreachItem])
async def outreach_queue(
    workspace_id: WorkspaceId,
    leads: Leads,
    templates: Annotated[TemplateRepository, Depends(get_template_repository)],
    limit: int = 20,
    template_id: str | None = None,
    min_score: int = 0,
):
    """Lista del día: leads con WhatsApp, sin «no contactar», ordenados por potencial."""
    content = await _template_content(templates, workspace_id, template_id)
    now = datetime.now(timezone.utc)
    candidates = [
        lead
        for lead in await leads.list_by_workspace(workspace_id, limit=10000)
        if is_contactable(lead)
        and (lead.score.value if lead.score else 0) >= min_score
        # no repetir a quien se le escribió en los últimos 3 días
        and (lead.last_contacted_at is None or now - lead.last_contacted_at > timedelta(days=3))
    ]
    candidates.sort(key=lambda lead: priority(lead, now), reverse=True)
    items = [_outreach_item(lead, content) for lead in candidates[: max(1, min(limit, 100))]]
    return [item for item in items if item is not None]


@router.get("/{lead_id}/outreach", response_model=OutreachItem)
async def lead_outreach(
    workspace_id: WorkspaceId,
    lead_id: str,
    leads: Leads,
    templates: Annotated[TemplateRepository, Depends(get_template_repository)],
    template_id: str | None = None,
):
    lead = await leads.get_by_id(workspace_id, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead no encontrado")
    if lead.do_not_contact:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este negocio pidió no ser contactado.")
    item = _outreach_item(lead, await _template_content(templates, workspace_id, template_id))
    if item is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Este negocio no tiene un número de WhatsApp válido.")
    return item


class ContactedBody(BaseModel):
    channel: str = Field(default="whatsapp", pattern="^(whatsapp|call|email|visit)$")
    follow_up_in_days: int | None = Field(default=3, ge=1, le=60)


class ContactedResult(BaseModel):
    lead_id: str
    status: str
    contact_attempts: int
    last_contacted_at: datetime
    next_follow_up_at: datetime | None


@router.post("/{lead_id}/contacted", response_model=ContactedResult)
async def mark_contacted(workspace_id: WorkspaceId, lead_id: str, body: ContactedBody, session: Session, leads: Leads, queue: Queue):
    """Registra el contacto y agenda el seguimiento (por defecto en 3 días)."""
    lead = await leads.get_by_id(workspace_id, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead no encontrado")
    if lead.do_not_contact:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este negocio pidió no ser contactado.")
    lead.register_contact()
    updated = await leads.update(workspace_id, lead)
    follow_ups = FollowUpService(session, queue)
    await follow_ups.cancel_pending_for_lead(workspace_id, updated.id, "new_contact")
    next_at = None
    if body.follow_up_in_days:
        next_at = datetime.now(timezone.utc) + timedelta(days=body.follow_up_in_days)
        await follow_ups.create(workspace_id, updated.id, next_at)
    await session.commit()
    return ContactedResult(
        lead_id=updated.id,
        status=updated.status.value,
        contact_attempts=updated.contact_attempts,
        last_contacted_at=updated.last_contacted_at or datetime.now(timezone.utc),
        next_follow_up_at=next_at,
    )
