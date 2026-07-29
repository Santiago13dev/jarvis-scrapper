"""
DTOs para autenticación / registro.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RegisterOrganizationRequest:
    organization_name: str
    admin_email: str
    admin_full_name: str
    admin_password: str
    default_workspace_name: str = "Principal"


@dataclass(frozen=True)
class RegisterOrganizationResult:
    organization_id: str
    workspace_id: str
    user_id: str


@dataclass(frozen=True)
class LoginRequest:
    email: str
    password: str


@dataclass(frozen=True)
class TokenPairResult:
    access_token: str
    refresh_token: str
    user_id: str
