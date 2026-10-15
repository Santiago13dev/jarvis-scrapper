"""
Caso de uso: ImportLeadsFromScraperUseCase.

Orquesta: ScraperProvider.search() → deduplicación vía LeadRepository →
LeadRepository.bulk_create() → EventBus.publish(LeadImportedEvent) por cada lead nuevo.

No conoce OpenAI, Postgres, ni gosom concretamente: sólo los Ports.
"""
from __future__ import annotations

from app.application.dto.lead_dto import ImportLeadsRequest, ImportLeadsResult
from app.application.ports.event_bus import EventBus
from app.application.ports.repositories.lead_repository import LeadRepository
from app.application.ports.scraper_provider import ScraperProvider, ScrapeQuery
from app.application.services.lead_deduplication_service import LeadDeduplicationService
from app.domain.countries import get_country
from app.domain.entities.lead import Lead
from app.domain.events.domain_events import LeadImportedEvent


class ImportLeadsFromScraperUseCase:
    def __init__(
        self,
        scraper_provider: ScraperProvider,
        lead_repository: LeadRepository,
        event_bus: EventBus,
        deduplication_service: LeadDeduplicationService | None = None,
    ) -> None:
        self._scraper = scraper_provider
        self._leads = lead_repository
        self._event_bus = event_bus
        self._deduplication = deduplication_service or LeadDeduplicationService()

    async def execute(self, request: ImportLeadsRequest) -> ImportLeadsResult:
        country = get_country(request.country)
        scraped = await self._scraper.search(
            ScrapeQuery(
                keyword=request.keyword,
                location=request.location,
                max_results=request.max_results,
                depth=request.depth,
                extract_emails=request.extract_emails,
                country=country.code,
            )
        )

        new_leads: list[Lead] = []
        skipped = 0
        closed = 0
        existing_leads = list(await self._leads.list_by_workspace(request.workspace_id, limit=10000))
        persisted_lead_ids = {lead.id for lead in existing_leads}
        existing_by_fingerprint = {
            fingerprint: lead
            for lead in existing_leads
            for fingerprint in self._deduplication.identify(lead, get_country(lead.country).dial_code).candidate_fingerprints
        }

        for business in scraped:
            if business.permanently_closed:
                closed += 1
                continue
            candidate = Lead(
                    workspace_id=request.workspace_id,
                    name=business.name,
                    raw_source_id=business.raw_source_id,
                    address=business.address,
                    phone=business.phone,
                    whatsapp=country.whatsapp_number(business.phone),
                    country=country.code,
                    website=business.website,
                    email=business.emails[0] if business.emails else None,
                    instagram=business.instagram,
                    facebook=business.facebook,
                    category=business.category,
                    rating=business.rating,
                    reviews_count=business.reviews_count,
                    latitude=business.latitude,
                    longitude=business.longitude,
                )
            identity = self._deduplication.identify(candidate, country.dial_code)
            self._deduplication.apply_identity(candidate, identity)
            existing = next(
                (existing_by_fingerprint[fingerprint] for fingerprint in identity.candidate_fingerprints if fingerprint in existing_by_fingerprint),
                None,
            )
            if existing is not None:
                self._deduplication.merge(existing, candidate)
                if existing.id in persisted_lead_ids:
                    await self._leads.update(request.workspace_id, existing)
                skipped += 1
                continue
            new_leads.append(candidate)
            for fingerprint in identity.candidate_fingerprints:
                existing_by_fingerprint[fingerprint] = candidate

        created = await self._leads.bulk_create(request.workspace_id, new_leads) if new_leads else []

        for lead in created:
            await self._event_bus.publish(
                LeadImportedEvent(workspace_id=request.workspace_id, lead_id=lead.id)
            )

        return ImportLeadsResult(imported=list(created), skipped_duplicates=skipped, skipped_closed=closed)
