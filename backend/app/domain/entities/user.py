"""
Entidad: User + rol por Workspace.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class WorkspaceRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


@dataclass
class User:
    organization_id: str
    email: str
    full_name: str
    hashed_password: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    is_superadmin: bool = False  # admin de ProspectAI, no de una organization
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def deactivate(self) -> None:
        self.is_active = False


@dataclass
class WorkspaceMembership:
    """Relación N:M entre User y Workspace, con rol."""
    user_id: str
    workspace_id: str
    role: WorkspaceRole = WorkspaceRole.MEMBER
