"""
Adapter: PostgresUserRepository + PostgresOrganizationRepository.
"""
from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mappers.organization_mapper import OrganizationMapper, WorkspaceMapper
from app.application.mappers.user_mapper import UserMapper
from app.application.ports.repositories.user_repository import OrganizationRepository, UserRepository
from app.domain.entities.organization import Organization, Workspace
from app.domain.entities.user import User
from app.infrastructure.database.models.organization import OrganizationModel
from app.infrastructure.database.models.user import UserModel, WorkspaceMembershipModel
from app.infrastructure.database.models.workspace import WorkspaceModel


class PostgresUserRepository(UserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: str) -> User | None:
        model = await self._session.get(UserModel, user_id)
        return UserMapper.to_entity(model) if model else None

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(UserModel).where(UserModel.email == email)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return UserMapper.to_entity(model) if model else None

    async def create(self, user: User) -> User:
        model = UserMapper.to_model(user)
        self._session.add(model)
        await self._session.flush()
        return UserMapper.to_entity(model)

    async def list_by_organization(self, organization_id: str) -> Sequence[User]:
        stmt = select(UserModel).where(UserModel.organization_id == organization_id)
        result = await self._session.execute(stmt)
        return [UserMapper.to_entity(m) for m in result.scalars().all()]

    async def get_workspace_role(self, user_id: str, workspace_id: str) -> str | None:
        stmt = select(WorkspaceMembershipModel.role).where(
            WorkspaceMembershipModel.user_id == user_id,
            WorkspaceMembershipModel.workspace_id == workspace_id,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def assign_workspace_role(self, user_id: str, workspace_id: str, role: str) -> None:
        membership = WorkspaceMembershipModel(user_id=user_id, workspace_id=workspace_id, role=role)
        self._session.add(membership)
        await self._session.flush()


class PostgresOrganizationRepository(OrganizationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_organization(self, organization_id: str) -> Organization | None:
        model = await self._session.get(OrganizationModel, organization_id)
        return OrganizationMapper.to_entity(model) if model else None

    async def create_organization(self, organization: Organization) -> Organization:
        model = OrganizationMapper.to_model(organization)
        self._session.add(model)
        await self._session.flush()
        return OrganizationMapper.to_entity(model)

    async def list_workspaces(self, organization_id: str) -> Sequence[Workspace]:
        stmt = select(WorkspaceModel).where(WorkspaceModel.organization_id == organization_id)
        result = await self._session.execute(stmt)
        return [WorkspaceMapper.to_entity(m) for m in result.scalars().all()]

    async def create_workspace(self, organization_id: str, workspace: Workspace) -> Workspace:
        model = WorkspaceMapper.to_model(workspace)
        self._session.add(model)
        await self._session.flush()
        return WorkspaceMapper.to_entity(model)
