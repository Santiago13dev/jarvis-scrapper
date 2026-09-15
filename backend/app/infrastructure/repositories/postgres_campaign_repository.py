"""
Adapter: PostgresCampaignRepository.
"""
from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.mappers.campaign_mapper import CampaignMapper
from app.application.ports.repositories.campaign_repository import CampaignRepository
from app.domain.entities.campaign import Campaign
from app.infrastructure.database.models.campaign import CampaignModel
from app.infrastructure.database.models.lead import LeadModel


class PostgresCampaignRepository(CampaignRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, workspace_id: str, campaign_id: str) -> Campaign | None:
        stmt = (
            select(CampaignModel)
            .where(CampaignModel.workspace_id == workspace_id, CampaignModel.id == campaign_id)
            .options(selectinload(CampaignModel.leads))
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return CampaignMapper.to_entity(model) if model else None

    async def list_by_workspace(
        self, workspace_id: str, status: str | None = None
    ) -> Sequence[Campaign]:
        stmt = select(CampaignModel).where(CampaignModel.workspace_id == workspace_id).options(
            selectinload(CampaignModel.leads)
        )
        if status:
            stmt = stmt.where(CampaignModel.status == status)
        result = await self._session.execute(stmt)
        return [CampaignMapper.to_entity(m) for m in result.scalars().all()]

    async def create(self, workspace_id: str, campaign: Campaign) -> Campaign:
        model = CampaignMapper.to_model(campaign)
        if campaign.lead_ids:
            leads_result = await self._session.execute(
                select(LeadModel).where(LeadModel.id.in_(campaign.lead_ids))
            )
            model.leads = list(leads_result.scalars().all())
        self._session.add(model)
        await self._session.flush()
        return CampaignMapper.to_entity(model)

    async def update(self, workspace_id: str, campaign: Campaign) -> Campaign:
        result = await self._session.execute(
            select(CampaignModel)
            .where(CampaignModel.workspace_id == workspace_id, CampaignModel.id == campaign.id)
            .options(selectinload(CampaignModel.leads))
        )
        model = result.scalar_one_or_none()
        if model is None or model.workspace_id != workspace_id:
            raise ValueError(f"Campaign {campaign.id} no encontrada en workspace {workspace_id}")
        model.name = campaign.name
        model.status = campaign.status.value
        model.scheduled_at = campaign.scheduled_at
        if campaign.lead_ids:
            leads_result = await self._session.execute(
                select(LeadModel).where(LeadModel.id.in_(campaign.lead_ids))
            )
            model.leads = list(leads_result.scalars().all())
        await self._session.flush()
        return CampaignMapper.to_entity(model)

    async def update_status(self, workspace_id: str, campaign_id: str, status: str) -> None:
        model = await self._session.get(CampaignModel, campaign_id)
        if model is not None and model.workspace_id == workspace_id:
            model.status = status
            await self._session.flush()

    async def delete(self, workspace_id: str, campaign_id: str) -> None:
        model = await self._session.get(CampaignModel, campaign_id)
        if model is not None and model.workspace_id == workspace_id:
            await self._session.delete(model)
            await self._session.flush()
