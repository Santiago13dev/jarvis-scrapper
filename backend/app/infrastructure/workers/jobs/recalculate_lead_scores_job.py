from __future__ import annotations

from app.application.dto.lead_scoring_dto import RecalculateLeadScoreRequest
from app.application.use_cases.recalculate_lead_score import RecalculateLeadScoreUseCase
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.repositories.postgres_lead_repository import PostgresLeadRepository


async def recalculate_lead_scores(ctx, payload: dict) -> dict:
    workspace_id = payload["workspace_id"]
    lead_ids = payload["lead_ids"]
    niche = payload.get("niche", "default")
    processed = 0
    failed: list[str] = []

    async with AsyncSessionLocal() as session:
        use_case = RecalculateLeadScoreUseCase(PostgresLeadRepository(session), session)
        for lead_id in lead_ids:
            try:
                await use_case.execute(
                    workspace_id,
                    lead_id,
                    RecalculateLeadScoreRequest(niche=niche),
                )
                processed += 1
            except ValueError:
                failed.append(lead_id)
        await session.commit()

    return {
        "workspace_id": workspace_id,
        "processed_count": processed,
        "failed_lead_ids": failed,
    }
