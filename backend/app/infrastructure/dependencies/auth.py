"""
Dependencias de autenticación/autorización para FastAPI.

`get_current_user` valida el JWT y carga el User. `require_workspace_access` además
verifica que el usuario tenga membership en el workspace solicitado (aislamiento
multi-tenant Organization → Workspace → User).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.application.ports.repositories.user_repository import UserRepository
from app.domain.entities.user import User
from app.infrastructure.dependencies.providers import get_user_repository
from app.shared.security.jwt import decode_token

_bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o expirado") from exc

    if payload.token_type != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Se requiere un access token")

    user = await user_repository.get_by_id(payload.sub)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no encontrado o inactivo")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_workspace_access(
    workspace_id: str,
    user: CurrentUser,
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> str:
    """Dependency parametrizable por path param `workspace_id`. Devuelve el workspace_id
    si el usuario tiene acceso; si no, 403."""
    role = await user_repository.get_workspace_role(user.id, workspace_id)
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a este workspace")
    return workspace_id
