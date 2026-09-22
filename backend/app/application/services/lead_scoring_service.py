from __future__ import annotations

from datetime import datetime, timezone

from app.application.dto.lead_scoring_dto import (
    LeadScoringReason,
    LeadScoringResult,
    LeadScoringWeights,
)
from app.domain.entities.lead import Lead
from app.domain.entities.web_audit import WebAudit


class LeadScoringService:
    """Calcula un score reproducible a partir del lead y su auditoría web."""

    def calculate(
        self,
        lead: Lead,
        audit: WebAudit | None = None,
        weights: LeadScoringWeights | None = None,
        niche: str = "default",
    ) -> LeadScoringResult:
        normalized = (weights or LeadScoringWeights()).normalized()
        audit = audit or WebAudit(lead_id=lead.id)
        raw_reasons = [
            ("El rating del negocio es 4.5 o superior", normalized["rating"] if (lead.rating or 0) >= 4.5 else 0),
            ("El negocio tiene al menos 100 reseñas", normalized["reviews"] if (lead.reviews_count or 0) >= 100 else 0),
            ("El lead tiene un canal de contacto", normalized["contact"] if any((lead.phone, lead.email, lead.whatsapp)) else 0),
            ("El lead tiene sitio web", normalized["website"] if lead.website else 0),
            ("El sitio web usa HTTPS", normalized["https"] if audit.https_enabled is True else 0),
            ("El sitio web responde correctamente", normalized["reachable"] if audit.website_reachable is True else 0),
            ("El sitio web es compatible con móviles", normalized["mobile"] if audit.mobile_friendly is True else 0),
            (
                "El sitio web tiene título y meta descripción",
                normalized["seo"] if audit.has_title is True and audit.has_meta_description is True else 0,
            ),
            (
                "El sitio web carga en 2 segundos o menos",
                normalized["performance"] if audit.load_time_ms is not None and audit.load_time_ms <= 2000 else 0,
            ),
        ]
        score = round(sum(points for _, points in raw_reasons))
        level = "high" if score >= 70 else "medium" if score >= 40 else "low"
        reasons = [LeadScoringReason(description=description, points=round(points, 2)) for description, points in raw_reasons]
        return LeadScoringResult(
            score=max(0, min(100, score)),
            level=level,
            reasons=reasons,
            calculated_at=datetime.now(timezone.utc),
            niche=niche,
        )
