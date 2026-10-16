"""
Router: /api/v1/workspaces/{workspace_id}/dashboard
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.repositories.statistics_repository import StatisticsRepository
from app.infrastructure.database.models.automation import AutopilotRuleModel, OutreachDraftModel
from app.infrastructure.database.models.conversation import ConversationModel, MessageModel
from app.infrastructure.database.models.lead import LeadModel
from app.infrastructure.database.models.workspace import WorkspaceModel
from app.infrastructure.database.session import get_db_session
from app.infrastructure.dependencies import get_statistics_repository, require_workspace_access

from .schemas import (
    ActivityItem,
    AutopilotRun,
    AutopilotStatus,
    DailyCount,
    DashboardOverviewResponse,
    DashboardSummaryResponse,
    PeriodTotals,
    TopOpportunity,
)

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


@router.get("/overview", response_model=DashboardOverviewResponse)
async def get_dashboard_overview(
    workspace_id: WorkspaceId,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> DashboardOverviewResponse:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    in_workspace = LeadModel.workspace_id == workspace_id

    async def count(stmt) -> int:
        return (await session.scalar(stmt)) or 0

    async def grouped(column) -> dict[str, int]:
        rows = await session.execute(select(column, func.count()).where(in_workspace).group_by(column))
        return {str(key): value for key, value in rows.all() if key is not None}

    drafts = OutreachDraftModel.workspace_id == workspace_id
    since = today - timedelta(days=13)
    day = func.date_trunc("day", LeadModel.created_at)
    per_day_rows = await session.execute(
        select(day, func.count()).where(in_workspace, LeadModel.created_at >= since).group_by(day)
    )
    per_day = {row[0].date().isoformat(): row[1] for row in per_day_rows.all()}

    top_rows = await session.execute(
        select(LeadModel)
        .where(in_workspace, LeadModel.status == "new", LeadModel.lead_score.is_not(None), LeadModel.do_not_contact.is_(False))
        .order_by(LeadModel.lead_score.desc(), LeadModel.reviews_count.desc().nulls_last())
        .limit(6)
    )
    rules = AutopilotRuleModel.workspace_id == workspace_id

    pipeline = await grouped(LeadModel.status)
    workspace = await session.get(WorkspaceModel, workspace_id)
    activity = await _recent_activity(session, workspace_id)
    window = now - timedelta(days=14)
    in_conversation = ConversationModel.workspace_id == workspace_id
    last_14_days = PeriodTotals(
        leads=await count(select(func.count(LeadModel.id)).where(in_workspace, LeadModel.created_at >= window)),
        drafted=await count(select(func.count(OutreachDraftModel.id)).where(drafts, OutreachDraftModel.created_at >= window)),
        sent=await count(select(func.count(OutreachDraftModel.id)).where(drafts, OutreachDraftModel.sent_at >= window)),
        replies=await count(
            select(func.count(MessageModel.id))
            .join(ConversationModel, ConversationModel.id == MessageModel.conversation_id)
            .where(in_conversation, MessageModel.direction == "inbound", MessageModel.sent_at >= window)
        ),
    )
    return DashboardOverviewResponse(
        total_leads=await count(select(func.count(LeadModel.id)).where(in_workspace)),
        high_opportunity=await count(select(func.count(LeadModel.id)).where(in_workspace, LeadModel.score_level == "high")),
        new_last_7_days=await count(
            select(func.count(LeadModel.id)).where(in_workspace, LeadModel.created_at >= now - timedelta(days=7))
        ),
        with_whatsapp=await count(select(func.count(LeadModel.id)).where(in_workspace, LeadModel.whatsapp.is_not(None))),
        pending_approvals=await count(
            select(func.count(OutreachDraftModel.id)).where(drafts, OutreachDraftModel.status == "pending_approval")
        ),
        scheduled_messages=await count(
            select(func.count(OutreachDraftModel.id)).where(drafts, OutreachDraftModel.status == "approved")
        ),
        sent_today=await count(
            select(func.count(OutreachDraftModel.id)).where(drafts, OutreachDraftModel.sent_at >= today)
        ),
        daily_send_limit=workspace.daily_send_limit if workspace else 40,
        sent_last_30_days=await count(
            select(func.count(OutreachDraftModel.id)).where(drafts, OutreachDraftModel.sent_at >= now - timedelta(days=30))
        ),
        replied=pipeline.get("replied", 0),
        won=pipeline.get("won", 0),
        pipeline=pipeline,
        by_service=await grouped(LeadModel.score_niche),
        by_country=await grouped(LeadModel.country),
        leads_per_day=[
            DailyCount(date=(since + timedelta(days=offset)).date().isoformat(), count=per_day.get((since + timedelta(days=offset)).date().isoformat(), 0))
            for offset in range(14)
        ],
        top_opportunities=[
            TopOpportunity(
                id=lead.id,
                name=lead.name,
                category=lead.category,
                country=lead.country,
                score=lead.lead_score,
                service=lead.score_niche,
                has_whatsapp=bool(lead.whatsapp),
            )
            for lead in top_rows.scalars()
        ],
        activity=activity,
        last_14_days=last_14_days,
        autopilot=AutopilotStatus(
            active_rules=await count(select(func.count(AutopilotRuleModel.id)).where(rules, AutopilotRuleModel.is_active.is_(True))),
            running_rules=await count(select(func.count(AutopilotRuleModel.id)).where(rules, AutopilotRuleModel.is_running.is_(True))),
            next_run_at=await session.scalar(
                select(func.min(AutopilotRuleModel.next_run_at)).where(rules, AutopilotRuleModel.is_active.is_(True))
            ),
            running=await _running_autopilot(session, workspace_id),
        ),
    )


async def _recent_activity(session: AsyncSession, workspace_id: str, limit: int = 8) -> list[ActivityItem]:
    """Lo último que hizo Jarvis: búsquedas, mensajes escritos/enviados y respuestas de clientes."""
    minute = func.date_trunc("minute", LeadModel.created_at)
    found = await session.execute(
        select(minute, LeadModel.country, func.count(), func.min(LeadModel.category))
        .where(LeadModel.workspace_id == workspace_id)
        .group_by(minute, LeadModel.country)
        .order_by(minute.desc())
        .limit(limit)
    )
    drafted_at = func.date_trunc("minute", OutreachDraftModel.created_at)
    drafted = await session.execute(
        select(drafted_at, func.count())
        .where(OutreachDraftModel.workspace_id == workspace_id)
        .group_by(drafted_at)
        .order_by(drafted_at.desc())
        .limit(limit)
    )
    sent_at = func.date_trunc("hour", OutreachDraftModel.sent_at)
    sent = await session.execute(
        select(sent_at, func.count())
        .where(OutreachDraftModel.workspace_id == workspace_id, OutreachDraftModel.sent_at.is_not(None))
        .group_by(sent_at)
        .order_by(sent_at.desc())
        .limit(limit)
    )
    replies = await session.execute(
        select(MessageModel.sent_at, LeadModel.name, LeadModel.country)
        .join(ConversationModel, ConversationModel.id == MessageModel.conversation_id)
        .join(LeadModel, LeadModel.id == ConversationModel.lead_id)
        .where(ConversationModel.workspace_id == workspace_id, MessageModel.direction == "inbound")
        .order_by(MessageModel.sent_at.desc())
        .limit(limit)
    )
    items = [
        *(ActivityItem(kind="found", at=at, count=total, detail=category, country=country) for at, country, total, category in found.all()),
        *(ActivityItem(kind="drafted", at=at, count=total) for at, total in drafted.all()),
        *(ActivityItem(kind="sent", at=at, count=total) for at, total in sent.all()),
        *(ActivityItem(kind="replied", at=at, count=1, detail=name, country=country) for at, name, country in replies.all()),
    ]
    return sorted(items, key=lambda item: item.at, reverse=True)[:limit]


async def _running_autopilot(session: AsyncSession, workspace_id: str) -> AutopilotRun | None:
    """Avance de la búsqueda automática en curso, para mostrarlo en Inicio."""
    rule = (
        await session.execute(
            select(AutopilotRuleModel)
            .where(AutopilotRuleModel.workspace_id == workspace_id, AutopilotRuleModel.is_running.is_(True))
            .limit(1)
        )
    ).scalar_one_or_none()
    if rule is None or not rule.progress:
        return None
    progress = rule.progress
    searches = progress.get("searches") or []
    current = min(progress.get("current", 0), max(len(searches) - 1, 0))
    active = searches[current] if searches and progress.get("stage") == "searching" else None
    return AutopilotRun(
        rule_name=rule.name,
        current=progress.get("current", 0),
        total=len(searches),
        stage=progress.get("stage", "searching"),
        keyword=active["keyword"] if active else None,
        location=active["location"] if active else None,
        new_leads=progress.get("new_leads", 0),
        started_at=progress.get("started_at"),
    )
