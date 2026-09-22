from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import update

from app.infrastructure.database.models.lead import LeadFollowUpModel
from app.infrastructure.database.session import AsyncSessionLocal


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
        )
        await session.commit()
    return {"follow_up_id": follow_up_id, "marked_due": bool(result.rowcount)}
