"""
Emisión y validación de JWT (access + refresh tokens).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.infrastructure.config.config import get_settings

settings = get_settings()


class TokenPayload:
    def __init__(self, sub: str, token_type: str, exp: datetime) -> None:
        self.sub = sub
        self.token_type = token_type
        self.exp = exp


def _create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "type": token_type, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str) -> str:
    return _create_token(
        user_id, "access", timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        user_id, "refresh", timedelta(days=settings.refresh_token_expire_days)
    )


def decode_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Token inválido o expirado") from exc

    return TokenPayload(
        sub=payload["sub"],
        token_type=payload["type"],
        exp=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
    )
