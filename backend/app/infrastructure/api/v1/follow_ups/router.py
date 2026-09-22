from __future__ import annotations

from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dto.follow_up_dto import (
    CancelFollowUpRequest,
    FollowUpResponse,
    RescheduleFollowUpRequest,
)
from app.application.ports.queue_provider import QueueProvider
from app.infrastructure.database.models.lead import LeadFollowUpModel
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import get_queue_provider, require_workspace_access

router = APIRouter()
WorkspaceId = Annotated[str, Depends(require_workspace_access)]


def _to_response(follow_up: LeadFollowUpModel) -> FollowUpResponse:
    return FollowUpResponse(
        id=follow_up.id,
        workspace_id=follow_up.workspace_id,
        lead_id=follow_up.lead_id,
        status=follow_up.status,
        next_follow_up_at=follow_up.next_follow_up_at,
        created_at=follow_up.created_at,
        completed_at=follow_up.completed_at,
        cancelled_at=follow_up.cancelled_at,
        cancel_reason=follow_up.cancel_reason,
    )


@router.get("", response_model=list[FollowUpResponse])
async def list_pending_follow_ups(
    workspace_id: WorkspaceId,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[FollowUpResponse]:
    result = await session.execute(
        select(LeadFollowUpModel)
        .where(
            LeadFollowUpModel.workspace_id == workspace_id,
            LeadFollowUpModel.status.in_(("pending", "due")),
        )
        .order_by(LeadFollowUpModel.next_follow_up_at.asc())
    )
    return [_to_response(item) for item in result.scalars().all()]


@router.patch("/{follow_up_id}/complete", response_model=FollowUpResponse)
async def complete_follow_up(
    workspace_id: WorkspaceId,
    follow_up_id: str,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> FollowUpResponse:
    follow_up = await _get_follow_up(session, workspace_id, follow_up_id)
    if follow_up.status not in ("pending", "due"):
        raise HTTPException(status.HTTP_409_CONFLICT, "El seguimiento ya no está pendiente")
    follow_up.status = "completed"
    follow_up.completed_at = datetime.now(timezone.utc)
    await session.commit()
    return _to_response(follow_up)


@router.patch("/{follow_up_id}/reschedule", response_model=FollowUpResponse)
async def reschedule_follow_up(
    workspace_id: WorkspaceId,
    follow_up_id: str,
    body: RescheduleFollowUpRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    queue: Annotated[QueueProvider, Depends(get_queue_provider)],
) -> FollowUpResponse:
    follow_up = await _get_follow_up(session, workspace_id, follow_up_id)
    if follow_up.status not in ("pending", "due"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Solo se pueden reprogramar seguimientos pendientes")
    next_at = body.next_follow_up_at
    if next_at.tzinfo is None:
        next_at = next_at.replace(tzinfo=timezone.utc)
    follow_up.status = "pending"
    follow_up.next_follow_up_at = next_at.astimezone(timezone.utc)
    await session.flush()
    delay = max(0, int((follow_up.next_follow_up_at - datetime.now(timezone.utc)).total_seconds()))
    await queue.enqueue("mark_follow_up_due", {"follow_up_id": follow_up.id}, defer_seconds=delay)
    await session.commit()
    return _to_response(follow_up)


@router.patch("/{follow_up_id}/cancel", response_model=FollowUpResponse)
async def cancel_follow_up(
    workspace_id: WorkspaceId,
    follow_up_id: str,
    body: CancelFollowUpRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> FollowUpResponse:
    follow_up = await _get_follow_up(session, workspace_id, follow_up_id)
    if follow_up.status not in ("pending", "due"):
        raise HTTPException(status.HTTP_409_CONFLICT, "El seguimiento ya no está pendiente")
    follow_up.status = "cancelled"
    follow_up.cancelled_at = datetime.now(timezone.utc)
    follow_up.cancel_reason = body.reason
    await session.commit()
    return _to_response(follow_up)


async def _get_follow_up(session: AsyncSession, workspace_id: str, follow_up_id: str) -> LeadFollowUpModel:
    result = await session.execute(
        select(LeadFollowUpModel).where(
            LeadFollowUpModel.id == follow_up_id,
            LeadFollowUpModel.workspace_id == workspace_id,
        )
    )
    follow_up = result.scalar_one_or_none()
    if follow_up is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seguimiento no encontrado")
    return follow_up
