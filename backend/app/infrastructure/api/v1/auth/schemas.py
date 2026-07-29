"""
Schemas Pydantic para auth. Nunca se exponen entidades de dominio directamente en la API.
"""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RegisterOrganizationBody(BaseModel):
    organization_name: str = Field(min_length=2, max_length=255)
    admin_email: EmailStr
    admin_full_name: str = Field(min_length=2, max_length=255)
    admin_password: str = Field(min_length=8)


class RegisterOrganizationResponse(BaseModel):
    organization_id: str
    workspace_id: str
    user_id: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
