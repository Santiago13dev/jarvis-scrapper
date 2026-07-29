"""
Mapper: Campaign ↔ CampaignModel.
"""
from __future__ import annotations

from app.domain.entities.campaign import Campaign, CampaignStatus
from app.infrastructure.database.models.campaign import CampaignModel


class CampaignMapper:
    @staticmethod
    def to_entity(model: CampaignModel) -> Campaign:
        return Campaign(
            id=model.id,
            workspace_id=model.workspace_id,
            name=model.name,
            message_template_id=model.message_template_id,
            lead_ids=[lead.id for lead in model.leads],
            status=CampaignStatus(model.status),
            scheduled_at=model.scheduled_at,
            created_at=model.created_at,
        )

    @staticmethod
    def to_model(entity: Campaign) -> CampaignModel:
        # Nota: la relación `leads` (N:M) se sincroniza aparte, en el repositorio,
        # ya que requiere consultar/asociar LeadModel existentes, no crearlos de nuevo.
        return CampaignModel(
            id=entity.id,
            workspace_id=entity.workspace_id,
            name=entity.name,
            message_template_id=entity.message_template_id,
            status=entity.status.value,
            scheduled_at=entity.scheduled_at,
            created_at=entity.created_at,
        )
