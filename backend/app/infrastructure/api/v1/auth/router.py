"""
Router: /api/v1/auth
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.application.dto.auth_dto import LoginRequest, RegisterOrganizationRequest
from app.application.ports.repositories.user_repository import OrganizationRepository, UserRepository
from app.application.use_cases.authenticate_user import AuthenticateUserUseCase, InvalidCredentialsError
from app.application.use_cases.register_organization import RegisterOrganizationUseCase
from app.infrastructure.dependencies import get_organization_repository, get_user_repository
from app.infrastructure.config.config import get_settings
from app.infrastructure.database.models.organization import OrganizationModel
from app.infrastructure.database.session import get_db_session
from app.shared.security.jwt import create_access_token, create_refresh_token, decode_token
from sqlalchemy.ext.asyncio import AsyncSession

from .schemas import (
    LoginBody,
    RegisterOrganizationBody,
    RegisterOrganizationResponse,
    TokenPairResponse,
)

router = APIRouter()


@router.post("/register", response_model=RegisterOrganizationResponse, status_code=status.HTTP_201_CREATED)
async def register_organization(
    body: RegisterOrganizationBody,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    organization_repository: Annotated[OrganizationRepository, Depends(get_organization_repository)],
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> RegisterOrganizationResponse:
    if not get_settings().allow_public_registration:
        existing = await session.scalar(select(func.count()).select_from(OrganizationModel))
        if existing:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "El registro está cerrado. Pide acceso al administrador.")
    use_case = RegisterOrganizationUseCase(organization_repository, user_repository)
    try:
        result = await use_case.execute(
            RegisterOrganizationRequest(
                organization_name=body.organization_name,
                admin_email=body.admin_email,
                admin_full_name=body.admin_full_name,
                admin_password=body.admin_password,
            )
        )
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    return RegisterOrganizationResponse(
        organization_id=result.organization_id,
        workspace_id=result.workspace_id,
        user_id=result.user_id,
    )


@router.post("/login", response_model=TokenPairResponse)
async def login(
    body: LoginBody,
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> TokenPairResponse:
    use_case = AuthenticateUserUseCase(user_repository)
    try:
        result = await use_case.execute(LoginRequest(email=body.email, password=body.password))
    except InvalidCredentialsError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    return TokenPairResponse(
        access_token=result.access_token, refresh_token=result.refresh_token, user_id=result.user_id
    )


class RefreshBody(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenPairResponse)
async def refresh_tokens(
    body: RefreshBody,
    user_repository: Annotated[UserRepository, Depends(get_user_repository)],
) -> TokenPairResponse:
    """Renueva la sesión sin volver a pedir la contraseña (el token de acceso dura 30 min)."""
    try:
        payload = decode_token(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión expiró. Inicia sesión de nuevo.") from exc
    if payload.token_type != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Se requiere un refresh token")
    user = await user_repository.get_by_id(payload.sub)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no encontrado o inactivo")
    return TokenPairResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user_id=user.id,
    )
