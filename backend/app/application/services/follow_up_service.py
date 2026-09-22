from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.queue_provider import QueueProvider
from app.infrastructure.database.models.lead import LeadFollowUpModel


class FollowUpService:
    def __init__(self, session: AsyncSession, queue: QueueProvider | None = None) -> None:
        self._session = session
        self._queue = queue

    async def create(self, workspace_id: str, lead_id: str, next_follow_up_at: datetime) -> LeadFollowUpModel:
        next_follow_up_at = self._as_utc(next_follow_up_at)
        follow_up = LeadFollowUpModel(
            workspace_id=workspace_id,
            lead_id=lead_id,
            next_follow_up_at=next_follow_up_at,
        )
        self._session.add(follow_up)
        await self._session.flush()
        if self._queue is not None:
            delay = max(0, int((next_follow_up_at - datetime.now(timezone.utc)).total_seconds()))
            await self._queue.enqueue(
                "mark_follow_up_due",
                {"follow_up_id": follow_up.id},
                defer_seconds=delay,
            )
        return follow_up

    async def cancel_pending_for_lead(self, workspace_id: str, lead_id: str, reason: str) -> int:
        now = datetime.now(timezone.utc)
        result = await self._session.execute(
            update(LeadFollowUpModel)
            .where(
                LeadFollowUpModel.workspace_id == workspace_id,
                LeadFollowUpModel.lead_id == lead_id,
                LeadFollowUpModel.status.in_(("pending", "due")),
            )
            .values(status="cancelled", cancelled_at=now, cancel_reason=reason)
        )
        return result.rowcount or 0

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
