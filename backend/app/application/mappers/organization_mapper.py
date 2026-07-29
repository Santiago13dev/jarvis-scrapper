"""
Mapper: Organization / Workspace ↔ OrganizationModel / WorkspaceModel.

Los mappers viven en `application/` (no en `infrastructure/`) porque son parte del
contrato entre capas: los repositorios de infraestructura los usan para no filtrar
objetos SQLAlchemy hacia el dominio ni casos de uso.
"""
from __future__ import annotations

from app.domain.entities.organization import Organization, Workspace
from app.infrastructure.database.models.organization import OrganizationModel
from app.infrastructure.database.models.workspace import WorkspaceModel


class OrganizationMapper:
    @staticmethod
    def to_entity(model: OrganizationModel) -> Organization:
        return Organization(
            id=model.id,
            name=model.name,
            is_active=model.is_active,
            created_at=model.created_at,
        )

    @staticmethod
    def to_model(entity: Organization) -> OrganizationModel:
        return OrganizationModel(
            id=entity.id,
            name=entity.name,
            is_active=entity.is_active,
            created_at=entity.created_at,
        )


class WorkspaceMapper:
    @staticmethod
    def to_entity(model: WorkspaceModel) -> Workspace:
        return Workspace(
            id=model.id,
            organization_id=model.organization_id,
            name=model.name,
            business_category=model.business_category,
            is_active=model.is_active,
            created_at=model.created_at,
        )

    @staticmethod
    def to_model(entity: Workspace) -> WorkspaceModel:
        return WorkspaceModel(
            id=entity.id,
            organization_id=entity.organization_id,
            name=entity.name,
            business_category=entity.business_category,
            is_active=entity.is_active,
            created_at=entity.created_at,
        )
