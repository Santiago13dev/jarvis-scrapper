"""
Router: /api/v1/workspaces/{workspace_id}/dashboard
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.ports.repositories.statistics_repository import StatisticsRepository
from app.infrastructure.dependencies import get_statistics_repository, require_workspace_access

from .schemas import DashboardSummaryResponse

router = APIRouter()

WorkspaceId = Annotated[str, Depends(require_workspace_access)]


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    workspace_id: WorkspaceId,
    statistics_repository: Annotated[StatisticsRepository, Depends(get_statistics_repository)],
) -> DashboardSummaryResponse:
    stats = await statistics_repository.get_dashboard_summary(workspace_id)
    return DashboardSummaryResponse(
        total_leads=stats.total_leads,
        total_campaigns_active=stats.total_campaigns_active,
        total_conversations_open=stats.total_conversations_open,
        total_conversations_transferred_to_human=stats.total_conversations_transferred_to_human,
        average_lead_score=stats.average_lead_score,
        messages_sent_last_30_days=stats.messages_sent_last_30_days,
        conversion_rate=stats.conversion_rate,
    )
