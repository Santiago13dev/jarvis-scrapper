"""
Adapter: PostgresStatisticsRepository — queries de agregación para el dashboard.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.repositories.statistics_repository import (
    DashboardStatistics,
    StatisticsRepository,
)
from app.infrastructure.database.models.campaign import CampaignModel
from app.infrastructure.database.models.conversation import ConversationModel, MessageModel
from app.infrastructure.database.models.lead import LeadModel


class PostgresStatisticsRepository(StatisticsRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_dashboard_summary(self, workspace_id: str) -> DashboardStatistics:
        total_leads = await self._scalar(
            select(func.count(LeadModel.id)).where(LeadModel.workspace_id == workspace_id)
        )
        total_campaigns_active = await self._scalar(
            select(func.count(CampaignModel.id)).where(
                CampaignModel.workspace_id == workspace_id, CampaignModel.status == "running"
            )
        )
        total_conversations_open = await self._scalar(
            select(func.count(ConversationModel.id)).where(
                ConversationModel.workspace_id == workspace_id,
                ConversationModel.is_transferred_to_human.is_(False),
            )
        )
        total_conversations_transferred = await self._scalar(
            select(func.count(ConversationModel.id)).where(
                ConversationModel.workspace_id == workspace_id,
                ConversationModel.is_transferred_to_human.is_(True),
            )
        )
        average_score = await self._scalar(
            select(func.avg(LeadModel.lead_score)).where(
                LeadModel.workspace_id == workspace_id, LeadModel.lead_score.is_not(None)
            )
        )
        messages_last_30_days = await self._scalar(
            select(func.count(MessageModel.id))
            .join(ConversationModel, ConversationModel.id == MessageModel.conversation_id)
            .where(
                ConversationModel.workspace_id == workspace_id,
                MessageModel.direction == "outbound",
            )
        )

        won_leads = await self._scalar(
            select(func.count(LeadModel.id)).where(
                LeadModel.workspace_id == workspace_id, LeadModel.status == "won"
            )
        )
        contacted_leads = await self._scalar(
            select(func.count(LeadModel.id)).where(
                LeadModel.workspace_id == workspace_id, LeadModel.status != "new"
            )
        )
        conversion_rate = (won_leads / contacted_leads) if contacted_leads else 0.0

        return DashboardStatistics(
            total_leads=total_leads or 0,
            total_campaigns_active=total_campaigns_active or 0,
            total_conversations_open=total_conversations_open or 0,
            total_conversations_transferred_to_human=total_conversations_transferred or 0,
            average_lead_score=float(average_score or 0),
            messages_sent_last_30_days=messages_last_30_days or 0,
            conversion_rate=round(conversion_rate, 4),
        )

    async def get_leads_scraped_per_day(
        self, workspace_id: str, start: date, end: date
    ) -> dict[date, int]:
        stmt = (
            select(func.date(LeadModel.created_at), func.count(LeadModel.id))
            .where(
                LeadModel.workspace_id == workspace_id,
                LeadModel.created_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc),
                LeadModel.created_at <= datetime.combine(end, datetime.max.time(), tzinfo=timezone.utc),
            )
            .group_by(func.date(LeadModel.created_at))
        )
        result = await self._session.execute(stmt)
        return {row[0]: row[1] for row in result.all()}

    async def get_campaign_performance(self, workspace_id: str, campaign_id: str) -> dict:
        total_messages = await self._scalar(
            select(func.count(MessageModel.id))
            .join(ConversationModel, ConversationModel.id == MessageModel.conversation_id)
            .where(ConversationModel.workspace_id == workspace_id)
        )
        return {"campaign_id": campaign_id, "total_messages_sent": total_messages or 0}

    async def _scalar(self, stmt) -> int | float | None:
        result = await self._session.execute(stmt)
        return result.scalar()
