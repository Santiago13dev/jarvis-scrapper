"""
Bandeja de aprobación de mensajes: Jarvis redacta, el usuario aprueba y el envío se
programa con límites diarios, pausas aleatorias y horario laboral del país del lead,
para proteger el número de WhatsApp de bloqueos.
"""
from __future__ import annotations

import random
from datetime import datetime, time, timedelta, timezone
from typing import Sequence
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.queue_provider import QueueProvider
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.services.outreach_message_service import OutreachMessageService
from app.domain.countries import get_country
from app.domain.entities.lead import Lead, LeadStatus
from app.infrastructure.database.models.automation import OutreachDraftModel
from app.infrastructure.database.models.workspace import WorkspaceModel

DAILY_SEND_LIMIT = 40
MIN_GAP_SECONDS = 60
MAX_GAP_SECONDS = 150
BUSINESS_HOURS = (time(9, 0), time(19, 0))
DEFAULT_MIN_SCORE = 70
FOLLOW_UP_AFTER = timedelta(days=3)


class OutreachService:
    def __init__(
        self,
        session: AsyncSession,
        lead_repository: LeadRepository,
        queue: QueueProvider | None = None,
        messages: OutreachMessageService | None = None,
    ) -> None:
        self._session = session
        self._leads = lead_repository
        self._queue = queue
        self._messages = messages or OutreachMessageService()

    # --- Redacción ------------------------------------------------------------------------

    async def draft_first_touch(
        self, workspace_id: str, lead_ids: Sequence[str], min_score: int | None = None
    ) -> list[OutreachDraftModel]:
        workspace = await self._session.get(WorkspaceModel, workspace_id)
        if min_score is None:
            min_score = workspace.min_score if workspace else DEFAULT_MIN_SCORE
        signature = workspace.outreach_signature if workspace else None
        already_drafted = set(
            (
                await self._session.execute(
                    select(OutreachDraftModel.lead_id).where(
                        OutreachDraftModel.workspace_id == workspace_id,
                        OutreachDraftModel.lead_id.in_(list(lead_ids)),
                        OutreachDraftModel.kind == "first_touch",
                    )
                )
            ).scalars()
        )
        drafts: list[OutreachDraftModel] = []
        for lead_id in lead_ids:
            if lead_id in already_drafted:
                continue
            lead = await self._leads.get_by_id(workspace_id, lead_id)
            if lead is None or not self.is_contactable(lead, min_score):
                continue
            draft = OutreachDraftModel(
                workspace_id=workspace_id,
                lead_id=lead.id,
                kind="first_touch",
                to_phone=lead.whatsapp,
                message=self._messages.first_touch(lead, signature),
                status="pending_approval",
            )
            self._session.add(draft)
            drafts.append(draft)
        await self._session.flush()
        return drafts

    async def draft_follow_up(self, workspace_id: str, lead_id: str) -> OutreachDraftModel | None:
        lead = await self._leads.get_by_id(workspace_id, lead_id)
        if lead is None or lead.do_not_contact or lead.status != LeadStatus.CONTACTED or not lead.whatsapp:
            return None
        exists = await self._session.scalar(
            select(func.count(OutreachDraftModel.id)).where(
                OutreachDraftModel.lead_id == lead_id, OutreachDraftModel.kind == "follow_up"
            )
        )
        if exists:
            return None
        draft = OutreachDraftModel(
            workspace_id=workspace_id,
            lead_id=lead_id,
            kind="follow_up",
            to_phone=lead.whatsapp,
            message=self._messages.follow_up(lead),
            status="pending_approval",
        )
        self._session.add(draft)
        await self._session.flush()
        return draft

    @staticmethod
    def is_contactable(lead: Lead, min_score: int) -> bool:
        score = lead.score.value if lead.score else None
        return (
            bool(lead.whatsapp)
            and not lead.do_not_contact
            and lead.status == LeadStatus.NEW
            and score is not None
            and score >= min_score
        )

    # --- Aprobación -----------------------------------------------------------------------

    async def approve(self, workspace_id: str, draft_ids: Sequence[str]) -> list[OutreachDraftModel]:
        drafts = (
            await self._session.execute(
                select(OutreachDraftModel)
                .where(
                    OutreachDraftModel.workspace_id == workspace_id,
                    OutreachDraftModel.id.in_(list(draft_ids)),
                    OutreachDraftModel.status == "pending_approval",
                )
                .order_by(OutreachDraftModel.created_at)
            )
        ).scalars().all()

        workspace = await self._session.get(WorkspaceModel, workspace_id)
        daily_limit = workspace.daily_send_limit if workspace else DAILY_SEND_LIMIT
        cursor = await self._last_scheduled(workspace_id)
        for draft in drafts:
            lead = await self._leads.get_by_id(workspace_id, draft.lead_id)
            cursor = await self._next_slot(
                workspace_id, cursor, get_country(lead.country if lead else None).timezone, daily_limit
            )
            draft.status = "approved"
            draft.scheduled_for = cursor
        await self._session.flush()

        if self._queue is not None:
            now = datetime.now(timezone.utc)
            for draft in drafts:
                delay = max(0, int((draft.scheduled_for - now).total_seconds()))
                await self._queue.enqueue("send_outreach_draft", {"draft_id": draft.id}, defer_seconds=delay)
        return list(drafts)

    async def reject(self, workspace_id: str, draft_ids: Sequence[str]) -> int:
        drafts = (
            await self._session.execute(
                select(OutreachDraftModel).where(
                    OutreachDraftModel.workspace_id == workspace_id,
                    OutreachDraftModel.id.in_(list(draft_ids)),
                    OutreachDraftModel.status.in_(("pending_approval", "approved")),
                )
            )
        ).scalars().all()
        for draft in drafts:
            draft.status = "rejected"
        await self._session.flush()
        return len(drafts)

    async def cancel_pending_for_lead(self, lead_id: str) -> None:
        drafts = (
            await self._session.execute(
                select(OutreachDraftModel).where(
                    OutreachDraftModel.lead_id == lead_id,
                    OutreachDraftModel.status.in_(("pending_approval", "approved")),
                )
            )
        ).scalars().all()
        for draft in drafts:
            draft.status = "rejected"
            draft.error = "El lead respondió o pidió no ser contactado"

    # --- Programación ---------------------------------------------------------------------

    async def _last_scheduled(self, workspace_id: str) -> datetime:
        latest = await self._session.scalar(
            select(func.max(OutreachDraftModel.scheduled_for)).where(
                OutreachDraftModel.workspace_id == workspace_id, OutreachDraftModel.status == "approved"
            )
        )
        now = datetime.now(timezone.utc)
        return max(_as_utc(latest), now) if latest else now

    async def _next_slot(
        self, workspace_id: str, after: datetime, tz_name: str, daily_limit: int = DAILY_SEND_LIMIT
    ) -> datetime:
        candidate = after + timedelta(seconds=random.randint(MIN_GAP_SECONDS, MAX_GAP_SECONDS))
        while True:
            candidate = self.within_business_hours(candidate, tz_name)
            if await self._sent_or_scheduled_on(workspace_id, candidate) < daily_limit:
                return candidate
            local = candidate.astimezone(ZoneInfo(tz_name))
            candidate = datetime.combine(local.date() + timedelta(days=1), BUSINESS_HOURS[0], ZoneInfo(tz_name))

    @staticmethod
    def within_business_hours(moment: datetime, tz_name: str) -> datetime:
        tz = ZoneInfo(tz_name)
        local = moment.astimezone(tz)
        start, end = BUSINESS_HOURS
        jitter = timedelta(minutes=random.randint(0, 20))
        if local.time() < start:
            local = datetime.combine(local.date(), start, tz) + jitter
        elif local.time() >= end:
            local = datetime.combine(local.date() + timedelta(days=1), start, tz) + jitter
        if local.weekday() == 6:  # domingo → lunes
            local = datetime.combine(local.date() + timedelta(days=1), start, tz) + jitter
        return local.astimezone(timezone.utc)

    async def _sent_or_scheduled_on(self, workspace_id: str, moment: datetime) -> int:
        day_start = moment.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        return await self._session.scalar(
            select(func.count(OutreachDraftModel.id)).where(
                OutreachDraftModel.workspace_id == workspace_id,
                OutreachDraftModel.status.in_(("approved", "sent")),
                func.coalesce(OutreachDraftModel.sent_at, OutreachDraftModel.scheduled_for) >= day_start,
                func.coalesce(OutreachDraftModel.sent_at, OutreachDraftModel.scheduled_for) < day_end,
            )
        ) or 0


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
