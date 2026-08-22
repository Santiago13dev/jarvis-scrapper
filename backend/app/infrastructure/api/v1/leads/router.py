"""
Router: /api/v1/workspaces/{workspace_id}/leads

Todo endpoint de negocio (no auth) vive bajo /workspaces/{workspace_id}/... para reflejar
el modelo multi-tenant Organization → Workspace → User; `require_workspace_access` valida
que el usuario autenticado tenga membership en ese workspace antes de continuar.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.conversation_dto import ExportLeadsRequest
from app.application.dto.lead_dto import AnalyzeLeadRequest, ImportLeadsRequest
from app.application.ports.ai_provider import AIProvider
from app.application.ports.event_bus import EventBus
from app.application.ports.file_storage_provider import FileStorageProvider
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.ports.scraper_provider import ScraperProvider
from app.application.use_cases.analyze_lead_with_ai import AnalyzeLeadWithAIUseCase
from app.application.use_cases.export_leads import ExportLeadsUseCase
from app.application.use_cases.import_leads_from_scraper import ImportLeadsFromScraperUseCase
from app.domain.entities.lead import Lead, LeadStatus
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import (
    get_ai_provider,
    get_event_bus,
    get_file_storage_provider,
    get_lead_repository,
    get_scraper_provider,
    require_workspace_access,
)

from .schemas import (
    AssignLeadBody,
    ExportLeadsBody,
    ExportLeadsResponse,
    ImportLeadsBody,
    ImportLeadsResponse,
    LeadResponse,
    UpdateLeadStatusBody,
)

router = APIRouter()

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
        category=lead.category,
        rating=lead.rating,
        reviews_count=lead.reviews_count,
        lead_score=lead.score.value if lead.score else None,
        lead_score_summary=lead.score.summary if lead.score else None,
        status=lead.status.value,
        owner_user_id=lead.owner_user_id,
        tags=lead.tags,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


@router.get("", response_model=list[LeadResponse])
async def list_leads(
    workspace_id: WorkspaceId,
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    limit: int = 50,
    offset: int = 0,
) -> list[LeadResponse]:
    leads = await lead_repository.list_by_workspace(workspace_id, limit=limit, offset=offset)
    return [_to_response(lead) for lead in leads]


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
) -> ImportLeadsResponse:
    use_case = ImportLeadsFromScraperUseCase(scraper_provider, lead_repository, event_bus)
    result = await use_case.execute(
        ImportLeadsRequest(
            workspace_id=workspace_id,
            keyword=body.keyword,
            location=body.location,
            max_results=body.max_results,
            depth=body.depth,
        )
    )
    await session.commit()
    return ImportLeadsResponse(
        imported_count=len(result.imported),
        skipped_duplicates=result.skipped_duplicates,
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


@router.patch("/{lead_id}/status", response_model=LeadResponse)
async def update_lead_status(
    workspace_id: WorkspaceId,
    lead_id: str,
    body: UpdateLeadStatusBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
) -> LeadResponse:
    lead = await lead_repository.get_by_id(workspace_id, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead no encontrado")
    try:
        lead.change_status(LeadStatus(body.status))
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Status inválido: {body.status}") from exc
    updated = await lead_repository.update(workspace_id, lead)
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
