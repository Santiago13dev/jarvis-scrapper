"""
DTOs de entrada/salida para casos de uso relacionados con Leads.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.entities.lead import Lead


@dataclass(frozen=True)
class ImportLeadsRequest:
    workspace_id: str
    keyword: str
    location: str
    max_results: int = 100
    depth: int = 1
    extract_emails: bool = False


@dataclass(frozen=True)
class ImportLeadsResult:
    imported: list[Lead]
    skipped_duplicates: int


@dataclass(frozen=True)
class AnalyzeLeadRequest:
    workspace_id: str
    lead_id: str
