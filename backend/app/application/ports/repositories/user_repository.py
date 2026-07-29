"""
Port: UserRepository

Modelo multi-tenant confirmado: Organization → Workspace → User.
Una Organization (agencia) tiene múltiples Workspaces (clientes/cuentas); un User
pertenece a una Organization y tiene roles/permisos por Workspace.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Sequence

if TYPE_CHECKING:
    from app.domain.entities.user import User
    from app.domain.entities.organization import Organization, Workspace


class UserRepository(ABC):

    @abstractmethod
    async def get_by_id(self, user_id: str) -> "User | None":
        raise NotImplementedError

    @abstractmethod
    async def get_by_email(self, email: str) -> "User | None":
        raise NotImplementedError

    @abstractmethod
    async def create(self, user: "User") -> "User":
        raise NotImplementedError

    @abstractmethod
    async def list_by_organization(self, organization_id: str) -> Sequence["User"]:
        raise NotImplementedError

    @abstractmethod
    async def get_workspace_role(self, user_id: str, workspace_id: str) -> str | None:
        """admin / member / viewer, etc. None si el usuario no tiene acceso al workspace."""
        raise NotImplementedError

    @abstractmethod
    async def assign_workspace_role(self, user_id: str, workspace_id: str, role: str) -> None:
        raise NotImplementedError


class OrganizationRepository(ABC):
    """Ports separado para la entidad Organization / Workspace (nivel superior al tenant)."""

    @abstractmethod
    async def get_organization(self, organization_id: str) -> "Organization | None":
        raise NotImplementedError

    @abstractmethod
    async def create_organization(self, organization: "Organization") -> "Organization":
        raise NotImplementedError

    @abstractmethod
    async def list_workspaces(self, organization_id: str) -> Sequence["Workspace"]:
        raise NotImplementedError

    @abstractmethod
    async def create_workspace(self, organization_id: str, workspace: "Workspace") -> "Workspace":
        raise NotImplementedError
