"""
Router: /api/v1/workspaces/{workspace_id}/automation
Piloto automático (búsquedas programadas) y bandeja de aprobación de mensajes.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.queue_provider import QueueProvider
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.services.outreach_service import OutreachService
from app.domain.countries import COUNTRIES
from app.infrastructure.database.models.automation import AutopilotRuleModel, OutreachDraftModel
from app.infrastructure.database.models.lead import LeadModel
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import get_lead_repository, get_queue_provider, require_workspace_access

from .schemas import (
    AutopilotRuleBody,
    AutopilotRuleResponse,
    AutopilotRuleUpdateBody,
    CountryResponse,
    DraftIdsBody,
    DraftLeadsBody,
    OutreachActionResult,
    OutreachDraftResponse,
    UpdateDraftBody,
)

router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]
Session = Annotated[AsyncSession, Depends(get_db_session)]


@router.get("/countries", response_model=list[CountryResponse])
async def list_countries(workspace_id: WorkspaceId) -> list[CountryResponse]:
    return [
        CountryResponse(
            code=country.code,
            name=country.name,
            language=country.language,
            show_prices=country.show_prices,
            cities=list(country.cities),
        )
        for country in COUNTRIES.values()
    ]


# --- Piloto automático --------------------------------------------------------------------


@router.get("/autopilot/rules", response_model=list[AutopilotRuleResponse])
async def list_rules(workspace_id: WorkspaceId, session: Session) -> list[AutopilotRuleModel]:
    result = await session.execute(
        select(AutopilotRuleModel)
        .where(AutopilotRuleModel.workspace_id == workspace_id)
        .order_by(AutopilotRuleModel.created_at.desc())
    )
    return list(result.scalars())


@router.post("/autopilot/rules", response_model=AutopilotRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(workspace_id: WorkspaceId, body: AutopilotRuleBody, session: Session) -> AutopilotRuleModel:
    # next_run_at = ahora: el próximo tick del worker (≤10 min) la ejecuta por primera vez
    rule = AutopilotRuleModel(workspace_id=workspace_id, next_run_at=datetime.now(timezone.utc), **body.model_dump())
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule


@router.patch("/autopilot/rules/{rule_id}", response_model=AutopilotRuleResponse)
async def update_rule(
    workspace_id: WorkspaceId, rule_id: str, body: AutopilotRuleUpdateBody, session: Session
) -> AutopilotRuleModel:
    rule = await _get_rule(session, workspace_id, rule_id)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(rule, key, value)
    await session.commit()
    await session.refresh(rule)
    return rule


@router.delete("/autopilot/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_rule(workspace_id: WorkspaceId, rule_id: str, session: Session) -> None:
    rule = await _get_rule(session, workspace_id, rule_id)
    await session.delete(rule)
    await session.commit()


@router.post("/autopilot/rules/{rule_id}/run", response_model=AutopilotRuleResponse)
async def run_rule_now(
    workspace_id: WorkspaceId,
    rule_id: str,
    session: Session,
    queue: Annotated[QueueProvider, Depends(get_queue_provider)],
) -> AutopilotRuleModel:
    rule = await _get_rule(session, workspace_id, rule_id)
    if rule.is_running:
        raise HTTPException(status.HTTP_409_CONFLICT, "Esta búsqueda ya se está ejecutando")
    await queue.enqueue("run_autopilot_rule", {"rule_id": rule.id})
    return rule


async def _get_rule(session: AsyncSession, workspace_id: str, rule_id: str) -> AutopilotRuleModel:
    rule = await session.get(AutopilotRuleModel, rule_id)
    if rule is None or rule.workspace_id != workspace_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Regla no encontrada")
    return rule


# --- Bandeja de aprobación ----------------------------------------------------------------


@router.get("/outreach", response_model=list[OutreachDraftResponse])
async def list_drafts(
    workspace_id: WorkspaceId, session: Session, status_filter: str | None = None, limit: int = 200
) -> list[OutreachDraftResponse]:
    stmt = (
        select(OutreachDraftModel, LeadModel)
        .join(LeadModel, LeadModel.id == OutreachDraftModel.lead_id)
        .where(OutreachDraftModel.workspace_id == workspace_id)
        .order_by(LeadModel.lead_score.desc().nulls_last(), OutreachDraftModel.created_at.desc())
        .limit(min(limit, 1000))
    )
    if status_filter:
        stmt = stmt.where(OutreachDraftModel.status.in_(status_filter.split(",")))
    rows = (await session.execute(stmt)).all()
    return [
        OutreachDraftResponse(
            id=draft.id,
            lead_id=lead.id,
            lead_name=lead.name,
            lead_category=lead.category,
            lead_country=lead.country,
            lead_score=lead.lead_score,
            service=lead.score_niche,
            kind=draft.kind,
            to_phone=draft.to_phone,
            message=draft.message,
            status=draft.status,
            scheduled_for=draft.scheduled_for,
            sent_at=draft.sent_at,
            error=draft.error,
            created_at=draft.created_at,
        )
        for draft, lead in rows
    ]


@router.post("/outreach/draft", response_model=OutreachActionResult)
async def draft_for_leads(
    workspace_id: WorkspaceId,
    body: DraftLeadsBody,
    session: Session,
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
) -> OutreachActionResult:
    drafts = await OutreachService(session, lead_repository).draft_first_touch(
        workspace_id, body.lead_ids, body.min_score
    )
    await session.commit()
    return OutreachActionResult(affected=len(drafts))


@router.patch("/outreach/{draft_id}", response_model=OutreachActionResult)
async def edit_draft(workspace_id: WorkspaceId, draft_id: str, body: UpdateDraftBody, session: Session) -> OutreachActionResult:
    draft = await session.get(OutreachDraftModel, draft_id)
    if draft is None or draft.workspace_id != workspace_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mensaje no encontrado")
    if draft.status != "pending_approval":
        raise HTTPException(status.HTTP_409_CONFLICT, "Solo se pueden editar mensajes pendientes de aprobación")
    draft.message = body.message.strip()
    await session.commit()
    return OutreachActionResult(affected=1)


@router.post("/outreach/approve", response_model=OutreachActionResult)
async def approve_drafts(
    workspace_id: WorkspaceId,
    body: DraftIdsBody,
    session: Session,
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
    queue: Annotated[QueueProvider, Depends(get_queue_provider)],
) -> OutreachActionResult:
    drafts = await OutreachService(session, lead_repository, queue).approve(workspace_id, body.draft_ids)
    await session.commit()
    schedule = sorted(draft.scheduled_for for draft in drafts if draft.scheduled_for)
    return OutreachActionResult(
        affected=len(drafts),
        first_scheduled_for=schedule[0] if schedule else None,
        last_scheduled_for=schedule[-1] if schedule else None,
    )


@router.post("/outreach/reject", response_model=OutreachActionResult)
async def reject_drafts(
    workspace_id: WorkspaceId,
    body: DraftIdsBody,
    session: Session,
    lead_repository: Annotated[LeadRepository, Depends(get_lead_repository)],
) -> OutreachActionResult:
    affected = await OutreachService(session, lead_repository).reject(workspace_id, body.draft_ids)
    await session.commit()
    return OutreachActionResult(affected=affected)
