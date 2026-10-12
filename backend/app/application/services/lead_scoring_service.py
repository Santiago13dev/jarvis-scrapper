from __future__ import annotations

from datetime import datetime, timezone

from app.application.dto.lead_scoring_dto import (
    LeadScoringReason,
    LeadScoringResult,
    LeadScoringWeights,
)
from app.domain.entities.lead import Lead
from app.domain.entities.web_audit import WebAudit
from app.domain.services.lead_enrichment import WebsiteKind, classify_website


class LeadScoringService:
    """
    Potencial de venta (0–100) de un lead para una agencia de servicios digitales.

    Combina dos dimensiones con los pesos de `LeadScoringWeights`:
    - ¿Vale la pena? (rating, reviews, contact): negocio activo y con quién hablar.
    - ¿Necesita ayuda digital? (website, https, reachable, mobile, seo, performance):
      cada carencia es una oportunidad concreta de venta. Si el negocio no tiene página
      propia, todas las carencias del sitio cuentan; si la tiene, solo las que mostró
      la auditoría (sin auditoría no se suman).
    El resultado es reproducible: mismo lead + misma auditoría = mismo puntaje.
    """

    def calculate(
        self,
        lead: Lead,
        audit: WebAudit | None = None,
        weights: LeadScoringWeights | None = None,
        niche: str = "default",
    ) -> LeadScoringResult:
        w = (weights or LeadScoringWeights()).normalized()
        audit = audit or WebAudit(lead_id=lead.id)
        rating = lead.rating or 0
        reviews = lead.reviews_count or 0

        rating_points = w["rating"] if rating >= 4.5 else w["rating"] * 0.6 if rating >= 4.0 else 0
        reviews_points = (
            w["reviews"] if reviews >= 100 else w["reviews"] * 0.6 if reviews >= 30 else w["reviews"] * 0.3 if reviews >= 10 else 0
        )
        contact_points = w["contact"] if lead.whatsapp else w["contact"] * 0.6 if (lead.phone or lead.email) else 0

        kind, detail = classify_website(lead.website)
        has_own_site = kind is WebsiteKind.OWN
        # WebAudit trae fecha por defecto: se considera auditado si tiene algún resultado real.
        audited = any(
            value is not None
            for value in (audit.website_reachable, audit.https_enabled, audit.mobile_friendly, audit.has_title, audit.load_time_ms)
        )

        reasons: list[tuple[str, float]] = [
            (
                f"Calificación de {rating:.1f} en Google" if rating else "Sin calificación en Google",
                rating_points,
            ),
            (f"{reviews} reseñas: negocio con clientes activos" if reviews else "Sin reseñas todavía", reviews_points),
            (
                "Tiene WhatsApp para contactarlo"
                if lead.whatsapp
                else "Tiene teléfono o correo para contactarlo"
                if (lead.phone or lead.email)
                else "Sin canal de contacto",
                contact_points,
            ),
        ]

        if not has_own_site:
            social = " (solo redes sociales)" if (lead.instagram or lead.facebook) else ""
            reasons.append((f"No tiene página web propia{social}: oportunidad de crearla", w["website"]))
            gaps = w["https"] + w["reachable"] + w["mobile"] + w["seo"] + w["performance"]
            reasons.append(("Sin presencia web que posicione en Google", gaps))
        else:
            reasons.append(
                ("Su web es un sitio gratuito (Wix, Blogspot…): oportunidad de profesionalizarla", w["website"] * 0.5)
                if detail == "free"
                else ("Ya tiene página web propia", 0)
            )
            if audited:
                reasons += [
                    ("Su sitio no usa HTTPS (aparece como «no seguro»)", w["https"] if audit.https_enabled is False else 0),
                    ("Su sitio no carga o da error", w["reachable"] if audit.website_reachable is False else 0),
                    ("Su sitio no está adaptado a celulares", w["mobile"] if audit.mobile_friendly is False else 0),
                    (
                        "A su sitio le falta título o descripción para Google",
                        w["seo"] if audit.has_title is False or audit.has_meta_description is False else 0,
                    ),
                    (
                        "Su sitio tarda más de 3 segundos en cargar",
                        w["performance"] if audit.load_time_ms is not None and audit.load_time_ms > 3000 else 0,
                    ),
                ]
            else:
                reasons.append(("Auditoría del sitio pendiente", 0))

        score = max(0, min(100, round(sum(points for _, points in reasons))))
        level = "high" if score >= 70 else "medium" if score >= 40 else "low"
        return LeadScoringResult(
            score=score,
            level=level,
            reasons=[LeadScoringReason(description=text, points=round(points, 2)) for text, points in reasons],
            calculated_at=datetime.now(timezone.utc),
            niche=niche,
        )
