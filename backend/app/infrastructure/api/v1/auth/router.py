"""
Router: /api/v1/auth
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.application.dto.auth_dto import LoginRequest, RegisterOrganizationRequest
from app.application.ports.repositories.user_repository import OrganizationRepository, UserRepository
from app.application.use_cases.authenticate_user import AuthenticateUserUseCase, InvalidCredentialsError
from app.application.use_cases.register_organization import RegisterOrganizationUseCase
from app.infrastructure.dependencies import get_organization_repository, get_user_repository
from app.infrastructure.database.session import get_db_session
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
