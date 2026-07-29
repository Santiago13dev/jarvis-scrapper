"""
Excepciones de dominio: reglas de negocio violadas, no errores técnicos/HTTP
(el mapeo a códigos HTTP ocurre en infrastructure/api).
"""
from __future__ import annotations


class DomainError(Exception):
    """Excepción base de dominio."""


class DuplicateLeadError(DomainError):
    def __init__(self, raw_source_id: str) -> None:
        super().__init__(f"Ya existe un lead importado con raw_source_id={raw_source_id}")
        self.raw_source_id = raw_source_id


class InvalidCampaignTransitionError(DomainError):
    def __init__(self, current_status: str, target_status: str) -> None:
        super().__init__(f"No se puede pasar la campaña de '{current_status}' a '{target_status}'")


class WorkspaceAccessDeniedError(DomainError):
    def __init__(self, user_id: str, workspace_id: str) -> None:
        super().__init__(f"El usuario {user_id} no tiene acceso al workspace {workspace_id}")


class KnowledgeBaseRequiredError(DomainError):
    """El agente IA no puede responder sin una base de conocimiento configurada (nunca inventa)."""
