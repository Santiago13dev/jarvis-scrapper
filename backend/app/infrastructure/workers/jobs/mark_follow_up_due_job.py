from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import update

from app.application.services.outreach_service import OutreachService
from app.infrastructure.database.models.lead import LeadFollowUpModel
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.repositories.postgres_lead_repository import PostgresLeadRepository


async def mark_follow_up_due(ctx, payload: dict) -> dict:
    follow_up_id = payload["follow_up_id"]
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            update(LeadFollowUpModel)
            .where(
                LeadFollowUpModel.id == follow_up_id,
                LeadFollowUpModel.status == "pending",
                LeadFollowUpModel.next_follow_up_at <= datetime.now(timezone.utc),
            )
            .values(status="due")
            .returning(LeadFollowUpModel.workspace_id, LeadFollowUpModel.lead_id)
        )
        marked = result.first()
        drafted = False
        if marked is not None:
            # Si el lead no ha respondido, Jarvis deja listo el mensaje de seguimiento para aprobar
            draft = await OutreachService(session, PostgresLeadRepository(session)).draft_follow_up(
                marked.workspace_id, marked.lead_id
            )
            drafted = draft is not None
        await session.commit()
    return {"follow_up_id": follow_up_id, "marked_due": marked is not None, "follow_up_drafted": drafted}
