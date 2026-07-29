"""
Caso de uso: RegisterOrganizationUseCase.

Alta de una nueva agencia (Organization) en la plataforma: crea Organization, un primer
Workspace por defecto, el User admin, y la membership admin de ese user en el workspace.
"""
from __future__ import annotations

from app.application.dto.auth_dto import RegisterOrganizationRequest, RegisterOrganizationResult
from app.application.ports.repositories.user_repository import OrganizationRepository, UserRepository
from app.domain.entities.organization import Organization, Workspace
from app.domain.entities.user import User, WorkspaceRole
from app.shared.security.password import hash_password


class RegisterOrganizationUseCase:
    def __init__(
        self,
        organization_repository: OrganizationRepository,
        user_repository: UserRepository,
    ) -> None:
        self._organizations = organization_repository
        self._users = user_repository

    async def execute(self, request: RegisterOrganizationRequest) -> RegisterOrganizationResult:
        existing_user = await self._users.get_by_email(request.admin_email)
        if existing_user is not None:
            raise ValueError(f"Ya existe un usuario con email {request.admin_email}")

        organization = await self._organizations.create_organization(
            Organization(name=request.organization_name)
        )

        workspace = await self._organizations.create_workspace(
            organization.id, Workspace(organization_id=organization.id, name=request.default_workspace_name)
        )

        user = await self._users.create(
            User(
                organization_id=organization.id,
                email=request.admin_email,
                full_name=request.admin_full_name,
                hashed_password=hash_password(request.admin_password),
            )
        )

        await self._users.assign_workspace_role(user.id, workspace.id, WorkspaceRole.ADMIN.value)

        return RegisterOrganizationResult(
            organization_id=organization.id, workspace_id=workspace.id, user_id=user.id
        )
