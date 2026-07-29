"""
Router: /api/v1/users
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.ports.repositories.user_repository import OrganizationRepository, UserRepository
from app.infrastructure.dependencies import CurrentUser, get_organization_repository, get_user_repository

from .schemas import UserResponse, WorkspaceResponse, WorkspaceRoleResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(user: CurrentUser) -> UserResponse:
    return UserResponse(
        id=user.id,
        organization_id=user.organization_id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
    )


@router.get("", response_model=list[UserResponse])
async def list_organization_users(
    user: CurrentUser,
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> list[UserResponse]:
    users = await user_repository.list_by_organization(user.organization_id)
    return [
        UserResponse(
            id=u.id, organization_id=u.organization_id, email=u.email,
            full_name=u.full_name, is_active=u.is_active,
        )
        for u in users
    ]


@router.get("/me/workspaces/{workspace_id}/role", response_model=WorkspaceRoleResponse)
async def get_my_workspace_role(
    workspace_id: str,
    user: CurrentUser,
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> WorkspaceRoleResponse:
    role = await user_repository.get_workspace_role(user.id, workspace_id)
    return WorkspaceRoleResponse(workspace_id=workspace_id, role=role)


@router.get("/me/workspaces", response_model=list[WorkspaceResponse])
async def list_my_workspaces(
    user: CurrentUser,
    organization_repository: Annotated[OrganizationRepository, Depends(get_organization_repository)],
) -> list[WorkspaceResponse]:
    """
    Simplificación del MVP: devuelve todos los workspaces de la organización del
    usuario. Cuando se afine el modelo de permisos por rol (ver TODO en
    ARCHITECTURE.md), esto debería filtrar sólo los workspaces donde el usuario
    tiene membership.
    """
    workspaces = await organization_repository.list_workspaces(user.organization_id)
    return [
        WorkspaceResponse(
            id=w.id, organization_id=w.organization_id, name=w.name,
            business_category=w.business_category, is_active=w.is_active,
        )
        for w in workspaces
    ]
