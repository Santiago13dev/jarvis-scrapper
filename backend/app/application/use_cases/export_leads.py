"""
Caso de uso: ExportLeadsUseCase.

Combina LeadRepository (datos) + FileStorageProvider (archivo), tal como se definió al
separar StorageProvider en dos responsabilidades. Soporta Excel, CSV y JSON.
"""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone

from openpyxl import Workbook

from app.application.dto.conversation_dto import ExportLeadsRequest, ExportLeadsResult
from app.application.ports.file_storage_provider import ExportFormat, FileStorageProvider
from app.application.ports.repositories.lead_repository import LeadRepository
from app.domain.entities.lead import Lead

_EXPORT_COLUMNS = [
    "id", "name", "address", "phone", "website", "email", "whatsapp",
    "instagram", "facebook", "category", "rating", "reviews_count",
    "lead_score", "status",
]


class ExportLeadsUseCase:
    def __init__(self, lead_repository: LeadRepository, file_storage: FileStorageProvider) -> None:
        self._leads = lead_repository
        self._file_storage = file_storage

    async def execute(self, request: ExportLeadsRequest) -> ExportLeadsResult:
        leads: list[Lead] = []
        for lead_id in request.lead_ids:
            lead = await self._leads.get_by_id(request.workspace_id, lead_id)
            if lead is not None:
                leads.append(lead)

        content = self._serialize(leads, request.fmt)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        filename = f"leads_export_{timestamp}.{request.fmt.value}"

        file_url = await self._file_storage.save_file(request.workspace_id, filename, content)
        return ExportLeadsResult(file_url=file_url, total_exported=len(leads))

    def _serialize(self, leads: list[Lead], fmt: ExportFormat) -> bytes:
        rows = [self._lead_to_row(lead) for lead in leads]

        if fmt == ExportFormat.JSON:
            return json.dumps(rows, ensure_ascii=False, indent=2).encode("utf-8")

        if fmt == ExportFormat.CSV:
            buffer = io.StringIO()
            writer = csv.DictWriter(buffer, fieldnames=_EXPORT_COLUMNS)
            writer.writeheader()
            writer.writerows(rows)
            return buffer.getvalue().encode("utf-8")

        if fmt == ExportFormat.EXCEL:
            workbook = Workbook()
            sheet = workbook.active
            sheet.title = "Leads"
            sheet.append(_EXPORT_COLUMNS)
            for row in rows:
                sheet.append([row.get(col, "") for col in _EXPORT_COLUMNS])
            buffer = io.BytesIO()
            workbook.save(buffer)
            return buffer.getvalue()

        raise ValueError(f"Formato de exportación no soportado: {fmt}")

    def _lead_to_row(self, lead: Lead) -> dict:
        return {
            "id": lead.id,
            "name": lead.name,
            "address": lead.address or "",
            "phone": lead.phone or "",
            "website": lead.website or "",
            "email": lead.email or "",
            "whatsapp": lead.whatsapp or "",
            "instagram": lead.instagram or "",
            "facebook": lead.facebook or "",
            "category": lead.category or "",
            "rating": lead.rating or "",
            "reviews_count": lead.reviews_count or "",
            "lead_score": lead.score.value if lead.score else "",
            "status": lead.status.value,
        }
