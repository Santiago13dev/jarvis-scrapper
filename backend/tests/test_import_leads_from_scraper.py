from __future__ import annotations

import pytest

from app.application.dto.lead_dto import ImportLeadsRequest
from app.application.use_cases.import_leads_from_scraper import ImportLeadsFromScraperUseCase
from app.application.ports.scraper_provider import ScrapedBusiness, ScrapeQuery
from app.domain.entities.lead import Lead


class FakeScraper:
    async def search(self, query: ScrapeQuery) -> list[ScrapedBusiness]:
        return [
            ScrapedBusiness("Acme", "Calle 1", "300123", None, "Servicios", None, None, None, None, "place-1"),
            ScrapedBusiness("Acme", "Calle 1", "300123", None, "Servicios", None, None, None, None, "place-1"),
        ]

    async def get_job_status(self, job_id: str) -> str:
        return "ok"


class FakeLeadRepository:
    def __init__(self) -> None:
        self.updated = 0
        self.created: list[Lead] = []

    async def list_by_workspace(self, workspace_id: str, limit: int = 50, offset: int = 0) -> list[Lead]:
        return []

    async def update(self, workspace_id: str, lead: Lead) -> Lead:
        self.updated += 1
        raise AssertionError("No debe actualizarse un lead que aun no fue persistido")

    async def bulk_create(self, workspace_id: str, leads: list[Lead]) -> list[Lead]:
        self.created.extend(leads)
        return leads


class FakeEventBus:
    async def publish(self, event: object) -> None:
        return None


@pytest.mark.asyncio
async def test_import_merges_duplicates_before_persisting() -> None:
    repository = FakeLeadRepository()
    use_case = ImportLeadsFromScraperUseCase(FakeScraper(), repository, FakeEventBus())

    result = await use_case.execute(
        ImportLeadsRequest(workspace_id="workspace-1", keyword="servicios", location="Bogota")
    )

    assert result.skipped_duplicates == 1
    assert len(result.imported) == 1
    assert len(repository.created) == 1
    assert repository.updated == 0
