from __future__ import annotations

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    organization_id: str
    email: str
    full_name: str
    is_active: bool


class WorkspaceRoleResponse(BaseModel):
    workspace_id: str
    role: str | None


class WorkspaceResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    business_category: str | None
    is_active: bool
