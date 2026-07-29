"""
Caso de uso: AuthenticateUserUseCase.
"""
from __future__ import annotations

from app.application.dto.auth_dto import LoginRequest, TokenPairResult
from app.application.ports.repositories.user_repository import UserRepository
from app.shared.security.jwt import create_access_token, create_refresh_token
from app.shared.security.password import verify_password


class InvalidCredentialsError(Exception):
    pass


class AuthenticateUserUseCase:
    def __init__(self, user_repository: UserRepository) -> None:
        self._users = user_repository

    async def execute(self, request: LoginRequest) -> TokenPairResult:
        user = await self._users.get_by_email(request.email)
        if user is None or not user.is_active:
            raise InvalidCredentialsError("Credenciales inválidas")

        if not verify_password(request.password, user.hashed_password):
            raise InvalidCredentialsError("Credenciales inválidas")

        return TokenPairResult(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
            user_id=user.id,
        )
