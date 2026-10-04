from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable

from app.domain.entities.lead import Lead


class LeadSearchService:
    """Busca inteligente en leads con priorización por coincidencias exactas del nombre, email y categorías."""

    def filter_and_rank(
        self,
        leads: Iterable[Lead],
        query: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        min_rating: float | None = None,
        has_email: bool = False,
        has_phone: bool = False,
        without_website: bool = False,
    ) -> list[Lead]:
        normalized_query = self._normalize_tokens(query or "")
        ordered: list[tuple[Lead, int]] = []

        for lead in leads:
            if status and self._normalize_text(lead.status.value if hasattr(lead.status, "value") else str(lead.status)) != self._normalize_text(status):
                continue
            if tag and tag.lower() not in {existing.lower() for existing in lead.tags}:
                continue
            if min_rating is not None and (lead.rating is None or lead.rating < min_rating):
                continue
            if has_email and not lead.email:
                continue
            if has_phone and not (lead.phone or lead.whatsapp):
                continue
            if without_website and lead.website:
                continue

            score = self._score_lead(lead, normalized_query)
            if normalized_query and score <= 0:
                continue
            ordered.append((lead, score))

        ordered.sort(key=lambda item: (-item[1], item[0].updated_at), reverse=True)
        return [lead for lead, _ in ordered]

    def _score_lead(self, lead: Lead, query_tokens: list[str]) -> int:
        if not query_tokens:
            return 0

        name_tokens = self._normalize_tokens(lead.name)
        email_tokens = self._normalize_tokens(lead.email or "")
        category_tokens = self._normalize_tokens(lead.category or "")
        address_tokens = self._normalize_tokens(lead.address or "")
        tags_tokens = self._normalize_tokens(" ".join(lead.tags))
        phone_digits = re.sub(r"\D", "", lead.phone or lead.whatsapp or "")
        website_domain = self._normalize_text(lead.website or "")

        score = 0
        for token in query_tokens:
            if not token:
                continue
            if token in name_tokens:
                score += 60
            elif self._contains_token(lead.name, token):
                score += 25
            if token in email_tokens:
                score += 50
            if token in category_tokens:
                score += 35
            if token in address_tokens:
                score += 15
            if phone_digits and token in phone_digits:
                score += 30
            if token in website_domain:
                score += 12
            if token in tags_tokens:
                score += 18
            if self._contains_token((lead.website or ""), token):
                score += 8

        return score

    @staticmethod
    def _normalize_tokens(value: str) -> list[str]:
        tokens = LeadSearchService._normalize_text(value).split()
        return [token for token in tokens if token]

    @staticmethod
    def _normalize_text(value: str | None) -> str:
        if not value:
            return ""
        text = unicodedata.normalize("NFKD", value)
        ascii_text = text.encode("ascii", "ignore").decode("ascii")
        text = ascii_text.lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def _contains_token(value: str | None, token: str) -> bool:
        if value is None:
            return False
        return token in LeadSearchService._normalize_tokens(value)
