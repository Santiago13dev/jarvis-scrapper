"""
Router: /api/v1/workspaces/{workspace_id}/leads

Todo endpoint de negocio (no auth) vive bajo /workspaces/{workspace_id}/... para reflejar
el modelo multi-tenant Organization → Workspace → User; `require_workspace_access` valida
que el usuario autenticado tenga membership en ese workspace antes de continuar.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.conversation_dto import ExportLeadsRequest
from app.application.dto.lead_dto import AnalyzeLeadRequest, ImportLeadsRequest
from app.application.ports.ai_provider import AIProvider
from app.application.ports.event_bus import EventBus
from app.application.ports.file_storage_provider import FileStorageProvider
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.ports.queue_provider import QueueProvider
from app.application.ports.scraper_provider import ScraperProvider
from app.application.use_cases.analyze_lead_with_ai import AnalyzeLeadWithAIUseCase
from app.application.use_cases.audit_lead_website import AuditLeadWebsiteUseCase
from app.application.services.lead_search_history_service import LeadSearchHistoryService
from app.application.services.lead_search_service import LeadSearchService
from app.application.services.website_audit_service import WebsiteAuditService
from app.application.services.follow_up_service import FollowUpService
from app.application.use_cases.export_leads import ExportLeadsUseCase
from app.application.use_cases.import_leads_from_scraper import ImportLeadsFromScraperUseCase
from app.application.use_cases.recalculate_lead_score import RecalculateLeadScoreUseCase
from app.domain.entities.lead import Lead, LeadStatus
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import (
    get_ai_provider,
    get_event_bus,
    get_file_storage_provider,
    get_lead_repository,
    get_queue_provider,
    get_scraper_provider,
    get_website_audit_service,
    require_workspace_access,
)

from .schemas import (
    AssignLeadBody,
    ExportLeadsBody,
    ExportLeadsResponse,
    ImportLeadsBody,
    ImportLeadsResponse,
    LeadResponse,
    LeadSearchHistoryBody,
    LeadSearchHistoryResponse,
    BulkRecalculateLeadScoreBody,
    BulkRecalculateLeadScoreResult,
    LeadScoringResponse,
    RecalculateLeadScoreBody,
    WebsiteAuditBody,
    WebsiteAuditResponse,
    UpdateLeadStatusBody,
)

router = APIRouter()
logger = logging.getLogger(__name__)

WorkspaceId = Annotated[str, Depends(require_workspace_access)]


def _to_response(lead: Lead) -> LeadResponse:
    return LeadResponse(
        id=lead.id,
        workspace_id=lead.workspace_id,
        name=lead.name,
        address=lead.address,
        phone=lead.phone,
        website=lead.website,
        email=lead.email,
        whatsapp=lead.whatsapp,
        instagram=lead.instagram,
        facebook=lead.facebook,
        listing_url=lead.listing_url,
        country=lead.country,
        category=lead.category,
        rating=lead.rating,
        reviews_count=lead.reviews_count,
        lead_score=lead.score.value if lead.score else None,
        lead_score_summary=lead.score.summary if lead.score else None,
        score_level=lead.score_level,
        score_reasons=lead.score_reasons,
        score_niche=lead.score_niche,
        score_calculated_at=lead.score_calculated_at,
        status=lead.status.value,
        owner_user_id=lead.owner_user_id,
        last_contacted_at=lead.last_contacted_at,
        contact_attempts=lead.contact_attempts,
        latitude=lead.latitude,
        longitude=lead.longitude,
        do_not_contact=lead.do_not_contact,
        tags=lead.tags,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


@router.get("", response_model=list[LeadResponse])
async def list_leads(
    workspace_id: WorkspaceId,
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    q: str | None = None,
    status: str | None = None,
    tag: str | None = None,
    min_rating: float | None = None,
    with_email: bool = False,
    with_phone: bool = False,
    without_website: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[LeadResponse]:
    leads = await lead_repository.list_by_workspace(workspace_id, limit=limit, offset=offset)
    filtered = LeadSearchService().filter_and_rank(
        leads,
        query=q,
        status=status,
        tag=tag,
        min_rating=min_rating,
        has_email=with_email,
        has_phone=with_phone,
        without_website=without_website,
    )
    return [_to_response(lead) for lead in filtered]


@router.get("/search-history", response_model=list[LeadSearchHistoryResponse])
async def list_search_history(
    workspace_id: WorkspaceId,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    limit: int = 5,
) -> list[LeadSearchHistoryResponse]:
    from sqlalchemy import desc, select
    from app.infrastructure.database.models.lead import LeadSearchHistoryModel

    stmt = (
        select(LeadSearchHistoryModel)
        .where(LeadSearchHistoryModel.workspace_id == workspace_id)
        .order_by(desc(LeadSearchHistoryModel.updated_at))
        .limit(limit)
    )
    result = await session.execute(stmt)
    return [
        LeadSearchHistoryResponse(
            id=item.id,
            workspace_id=item.workspace_id,
            query=item.query,
            filters=item.filters or {},
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in result.scalars().all()
    ]


@router.post("/search-history", response_model=LeadSearchHistoryResponse)
async def save_search_history(
    workspace_id: WorkspaceId,
    body: LeadSearchHistoryBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> LeadSearchHistoryResponse:
    from sqlalchemy import select
    from app.infrastructure.database.models.lead import LeadSearchHistoryModel

    query = LeadSearchHistoryService.normalize_query(body.query)
    if not query:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "La búsqueda no puede estar vacía")

    stmt = select(LeadSearchHistoryModel).where(
        LeadSearchHistoryModel.workspace_id == workspace_id,
        LeadSearchHistoryModel.query == query,
    )
    result = await session.execute(stmt)
    item = result.scalar_one_or_none()

    if item is None:
        item = LeadSearchHistoryModel(
            workspace_id=workspace_id,
            query=query,
            filters=body.filters or {},
        )
        session.add(item)
    else:
        item.filters = body.filters or {}
        item.updated_at = datetime.now(timezone.utc)

    await session.flush()
    return LeadSearchHistoryResponse(
        id=item.id,
        workspace_id=item.workspace_id,
        query=item.query,
        filters=item.filters or {},
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    workspace_id: WorkspaceId,
    lead_id: str,
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
) -> LeadResponse:
    lead = await lead_repository.get_by_id(workspace_id, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead no encontrado")
    return _to_response(lead)


@router.post("/import", response_model=ImportLeadsResponse, status_code=status.HTTP_201_CREATED)
async def import_leads(
    workspace_id: WorkspaceId,
    body: ImportLeadsBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    scraper_provider: Annotated[ScraperProvider, Depends(get_scraper_provider)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
    queue: Annotated[QueueProvider, Depends(get_queue_provider)],
) -> ImportLeadsResponse:
    use_case = ImportLeadsFromScraperUseCase(scraper_provider, lead_repository, event_bus)
    try:
        result = await use_case.execute(
            ImportLeadsRequest(
                workspace_id=workspace_id,
                keyword=body.keyword,
                location=body.location,
                max_results=body.max_results,
                depth=body.depth,
                extract_emails=body.extract_emails,
                country=body.country,
            )
        )
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No se pudo conectar al servicio de scraping. "
                "Asegura que google-maps-scraper este levantado y vuelve a intentar."
            ),
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Fallo la comunicacion con el servicio de scraping.",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    await session.commit()
    if result.imported:
        try:
            await queue.enqueue(
                "enrich_imported_leads",
                {"workspace_id": workspace_id, "lead_ids": [lead.id for lead in result.imported]},
            )
        except Exception:
            # Sin Redis/worker los leads quedan importados; se pueden auditar y puntuar manualmente
            logger.exception("No se pudo encolar el enriquecimiento de leads importados")
    return ImportLeadsResponse(
        imported_count=len(result.imported),
        skipped_duplicates=result.skipped_duplicates,
        skipped_closed=result.skipped_closed,
        leads=[_to_response(lead) for lead in result.imported],
    )


@router.post("/{lead_id}/analyze", response_model=LeadResponse)
async def analyze_lead(
    workspace_id: WorkspaceId,
    lead_id: str,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    ai_provider: Annotated[AIProvider, Depends(get_ai_provider)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    event_bus: Annotated[EventBus, Depends(get_event_bus)],
) -> LeadResponse:
    use_case = AnalyzeLeadWithAIUseCase(ai_provider, lead_repository, event_bus)
    try:
        lead = await use_case.execute(AnalyzeLeadRequest(workspace_id=workspace_id, lead_id=lead_id))
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await session.commit()
    return _to_response(lead)


@router.post("/{lead_id}/score", response_model=LeadScoringResponse)
async def recalculate_lead_score(
    workspace_id: WorkspaceId,
    lead_id: str,
    body: RecalculateLeadScoreBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
) -> LeadScoringResponse:
    use_case = RecalculateLeadScoreUseCase(lead_repository, session)
    try:
        result = await use_case.execute(workspace_id, lead_id, body)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await session.commit()
    return result


@router.post("/{lead_id}/audit", response_model=WebsiteAuditResponse)
async def audit_lead_website(
    workspace_id: WorkspaceId,
    lead_id: str,
    body: WebsiteAuditBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    audit_service: Annotated[WebsiteAuditService, Depends(get_website_audit_service)],
) -> WebsiteAuditResponse:
    use_case = AuditLeadWebsiteUseCase(lead_repository, session, audit_service)
    try:
        result = await use_case.execute(workspace_id, lead_id, body.url)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    await session.commit()
    return result


@router.post("/score/bulk", response_model=BulkRecalculateLeadScoreResult, status_code=status.HTTP_202_ACCEPTED)
async def queue_bulk_lead_scoring(
    workspace_id: WorkspaceId,
    body: BulkRecalculateLeadScoreBody,
    queue: Annotated[QueueProvider, Depends(get_queue_provider)],
) -> BulkRecalculateLeadScoreResult:
    job_id = await queue.enqueue(
        "recalculate_lead_scores",
        {"workspace_id": workspace_id, "lead_ids": body.lead_ids, "niche": body.niche},
    )
    return BulkRecalculateLeadScoreResult(job_id=job_id, queued_count=len(body.lead_ids))


@router.patch("/{lead_id}/status", response_model=LeadResponse)
async def update_lead_status(
    workspace_id: WorkspaceId,
    lead_id: str,
    body: UpdateLeadStatusBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    queue: Annotated[QueueProvider, Depends(get_queue_provider)],
) -> LeadResponse:
    lead = await lead_repository.get_by_id(workspace_id, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead no encontrado")
    previous_status = lead.status
    try:
        lead.change_status(LeadStatus(body.status))
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Status inválido: {body.status}") from exc
    if body.do_not_contact is not None:
        lead.do_not_contact = body.do_not_contact
    updated = await lead_repository.update(workspace_id, lead)
    follow_ups = FollowUpService(session, queue)
    if updated.status == LeadStatus.CONTACTED and previous_status != LeadStatus.CONTACTED:
        next_at = body.next_follow_up_at or (datetime.now(timezone.utc) + timedelta(days=1))
        if not updated.do_not_contact:
            await follow_ups.create(workspace_id, updated.id, next_at)
    elif updated.status == LeadStatus.REPLIED:
        await follow_ups.cancel_pending_for_lead(workspace_id, updated.id, "lead_replied")
    if updated.do_not_contact:
        await follow_ups.cancel_pending_for_lead(workspace_id, updated.id, "do_not_contact")
    await session.commit()
    return _to_response(updated)


@router.patch("/{lead_id}/assign", response_model=LeadResponse)
async def assign_lead(
    workspace_id: WorkspaceId,
    lead_id: str,
    body: AssignLeadBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
) -> LeadResponse:
    lead = await lead_repository.get_by_id(workspace_id, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead no encontrado")
    lead.assign_to(body.user_id)
    updated = await lead_repository.update(workspace_id, lead)
    await session.commit()
    return _to_response(updated)


@router.post("/export", response_model=ExportLeadsResponse)
async def export_leads(
    workspace_id: WorkspaceId,
    body: ExportLeadsBody,
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    file_storage: Annotated[FileStorageProvider, Depends(get_file_storage_provider)],
) -> ExportLeadsResponse:
    use_case = ExportLeadsUseCase(lead_repository, file_storage)
    result = await use_case.execute(
        ExportLeadsRequest(workspace_id=workspace_id, lead_ids=body.lead_ids, fmt=body.format)
    )
    return ExportLeadsResponse(file_url=result.file_url, total_exported=result.total_exported)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_lead(
    workspace_id: WorkspaceId,
    lead_id: str,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
) -> None:
    lead = await lead_repository.get_by_id(workspace_id, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead no encontrado")
    await lead_repository.delete(workspace_id, lead_id)
    await session.commit()
