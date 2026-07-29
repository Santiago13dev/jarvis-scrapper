"""
Adapter: PostgresLeadRepository — implementa el port LeadRepository con SQLAlchemy.
"""
from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.mappers.lead_mapper import LeadMapper
from app.application.ports.repositories.lead_repository import LeadRepository
from app.domain.entities.lead import Lead
from app.infrastructure.database.models.lead import LeadModel


class PostgresLeadRepository(LeadRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, workspace_id: str, lead_id: str) -> Lead | None:
        stmt = (
            select(LeadModel)
            .where(LeadModel.workspace_id == workspace_id, LeadModel.id == lead_id)
            .options(selectinload(LeadModel.notes), selectinload(LeadModel.tasks))
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return LeadMapper.to_entity(model) if model else None

    async def list_by_workspace(
        self, workspace_id: str, limit: int = 50, offset: int = 0
    ) -> Sequence[Lead]:
        stmt = (
            select(LeadModel)
            .where(LeadModel.workspace_id == workspace_id)
            .options(selectinload(LeadModel.notes), selectinload(LeadModel.tasks))
            .order_by(LeadModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return [LeadMapper.to_entity(m) for m in result.scalars().all()]

    async def find_duplicate(self, workspace_id: str, raw_source_id: str) -> Lead | None:
        stmt = select(LeadModel).where(
            LeadModel.workspace_id == workspace_id, LeadModel.raw_source_id == raw_source_id
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return LeadMapper.to_entity(model) if model else None

    async def create(self, workspace_id: str, lead: Lead) -> Lead:
        model = LeadMapper.to_model(lead)
        self._session.add(model)
        await self._session.flush()
        return LeadMapper.to_entity(model)

    async def update(self, workspace_id: str, lead: Lead) -> Lead:
        model = await self._session.get(LeadModel, lead.id)
        if model is None or model.workspace_id != workspace_id:
            raise ValueError(f"Lead {lead.id} no encontrado en workspace {workspace_id}")

        updated = LeadMapper.to_model(lead)
        for column in LeadModel.__table__.columns.keys():
            if column not in ("id",):
                setattr(model, column, getattr(updated, column))

        await self._session.flush()
        return LeadMapper.to_entity(model)

    async def bulk_create(self, workspace_id: str, leads: Sequence[Lead]) -> Sequence[Lead]:
        models = [LeadMapper.to_model(lead) for lead in leads]
        self._session.add_all(models)
        await self._session.flush()
        return [LeadMapper.to_entity(m) for m in models]

    async def delete(self, workspace_id: str, lead_id: str) -> None:
        model = await self._session.get(LeadModel, lead_id)
        if model is not None and model.workspace_id == workspace_id:
            await self._session.delete(model)
            await self._session.flush()
