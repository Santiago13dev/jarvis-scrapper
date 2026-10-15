from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from app.application.dto.lead_scoring_dto import (
    LeadScoringReason,
    LeadScoringResult,
    LeadScoringWeights,
)
from app.domain.countries import get_country
from app.domain.entities.lead import Lead
from app.domain.entities.web_audit import WebAudit

# Categorías de Google Maps (normalizadas sin tildes) donde cada servicio encaja mejor.
# Cada clave se compara al inicio de una palabra: "medic" acepta "medicina" pero "shop" no acepta "barbershop".
RETAIL_CATEGORIES = (
    "tienda", "boutique", "ropa", "calzado", "zapateria", "joyeria", "ferreteria", "libreria", "papeleria",
    "jugueteria", "cosmeticos", "perfumeria", "floristeria", "panaderia", "pasteleria", "licoreria", "muebleria",
    "electrodomestico", "celulares", "tecnologia", "almacen", "distribuidora", "accesorios", "optica",
    "mascotas", "suplementos", "store", "shop",
    # Categorías de Google Maps en inglés (EE. UU.)
    "clothing", "shoe", "jewelry", "hardware", "bookstore", "toy", "cosmetics", "florist", "bakery",
    "liquor", "furniture", "appliance", "cell phone", "electronics", "pet", "optical", "supplement", "gift",
)
HIGH_INQUIRY_CATEGORIES = (
    "clinica", "odontolog", "dental", "dentista", "medic", "consultorio", "estetica", "spa", "veterinari", "inmobiliaria",
    "hotel", "hostal", "restaurante", "gimnasio", "academia", "colegio", "instituto", "taller", "concesionario",
    "abogado", "notaria", "laboratorio", "fisioterap", "psicolog", "salon de belleza", "peluqueria", "barberia",
    "clinic", "dentist", "medical", "doctor", "veterinar", "real estate", "restaurant", "gym", "fitness",
    "school", "auto repair", "car dealer", "lawyer", "attorney", "law firm", "physical therap", "beauty salon",
    "hair salon", "barber", "nail salon", "med spa",
)
COMPETITIVE_CATEGORIES = (
    "abogado", "odontolog", "dental", "dentista", "clinica", "cirujano", "inmobiliaria", "constructora", "contador",
    "seguros", "estetica", "dermatolog", "arquitect", "consultor", "agencia", "escuela", "universidad",
    "lawyer", "attorney", "law firm", "dentist", "orthodont", "plastic surgeon", "real estate", "contractor",
    "roofing", "plumber", "hvac", "insurance", "accountant", "med spa", "chiropractor",
)


@dataclass(frozen=True)
class JarvisService:
    key: str
    name: str
    price: str


SERVICES: dict[str, JarvisService] = {
    "landing": JarvisService("landing", "Landing Page Profesional", "desde $800.000 COP"),
    "web": JarvisService("web", "Página Web Corporativa", "desde $1.500.000 COP"),
    "ecommerce": JarvisService("ecommerce", "Tienda Virtual", "desde $2.200.000 COP"),
    "seo": JarvisService("seo", "Posicionamiento SEO", "desde $500.000 COP/mes"),
    "ads": JarvisService("ads", "SEO + Google Ads", "desde $800.000 COP/mes"),
    "whatsapp_ai": JarvisService("whatsapp_ai", "Asistente IA para WhatsApp", "desde $1.000.000 COP"),
}

Rule = tuple[str, float]


def _normalize(text: str | None) -> str:
    decomposed = unicodedata.normalize("NFKD", (text or "").lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _category_matches(lead: Lead, keywords: tuple[str, ...]) -> bool:
    category = _normalize(lead.category)
    return any(re.search(rf"\b{re.escape(keyword)}", category) for keyword in keywords)


class LeadScoringService:
    """
    Calcula un score de oportunidad comercial reproducible: qué tanto necesita el negocio
    un servicio de Jarvis IA y qué tanto puede pagarlo.

    - niche = clave de servicio (landing, web, ecommerce, seo, ads, whatsapp_ai): puntúa ese servicio.
    - niche = default/auto u otro valor: evalúa todos y se queda con el servicio de mayor puntaje.
    - weights explícitos: modo personalizado heredado (calidad de presencia digital ponderada).
    """

    def calculate(
        self,
        lead: Lead,
        audit: WebAudit | None = None,
        weights: LeadScoringWeights | None = None,
        niche: str = "default",
    ) -> LeadScoringResult:
        audit = audit or WebAudit(lead_id=lead.id)
        if weights is not None:
            return self._weighted_quality(lead, audit, weights, niche)

        profiles: dict[str, Callable[[Lead, WebAudit], list[Rule]]] = {
            "landing": self._website_rules,
            "web": self._website_rules,
            "ecommerce": self._ecommerce_rules,
            "seo": self._seo_rules,
            "ads": self._ads_rules,
            "whatsapp_ai": self._whatsapp_ai_rules,
        }
        if niche in profiles:
            candidates = [niche]
        else:
            # landing/web comparten reglas; el tamaño del negocio decide cuál ofrecer
            website_key = "web" if (lead.reviews_count or 0) >= 100 else "landing"
            candidates = [website_key, "ecommerce", "seo", "ads", "whatsapp_ai"]

        best_key, best_rules = max(
            ((key, profiles[key](lead, audit)) for key in candidates),
            key=lambda item: sum(points for _, points in item[1]),
        )
        return self._build_result(best_rules, best_key, SERVICES[best_key], get_country(lead.country).show_prices)

    # --- Perfiles por servicio -------------------------------------------------------------

    @staticmethod
    def _base_rules(lead: Lead) -> list[Rule]:
        reviews = lead.reviews_count or 0
        return [
            ("Negocio muy establecido (200+ reseñas)", 20 if reviews >= 200 else 0),
            ("Negocio establecido (50+ reseñas)", 12 if 50 <= reviews < 200 else 0),
            ("Buena reputación (rating 4.0 o superior)", 10 if (lead.rating or 0) >= 4.0 else 0),
            ("Tiene canal de contacto directo", 10 if any((lead.phone, lead.email, lead.whatsapp)) else 0),
        ]

    def _website_rules(self, lead: Lead, audit: WebAudit) -> list[Rule]:
        has_social = bool(lead.instagram or lead.facebook)
        weak_site = audit.website_reachable is True and (
            audit.https_enabled is False
            or audit.mobile_friendly is False
            or (audit.load_time_ms is not None and audit.load_time_ms > 3000)
        )
        return [
            ("No tiene página web propia", 45 if not lead.website else 0),
            ("Solo tiene redes sociales: ya vende en digital", 5 if not lead.website and has_social else 0),
            ("Su sitio web está caído o no responde", 40 if lead.website and audit.website_reachable is False else 0),
            ("Su sitio web es deficiente (sin HTTPS, no móvil o lento)", 25 if lead.website and weak_site else 0),
            *self._base_rules(lead),
        ]

    def _ecommerce_rules(self, lead: Lead, audit: WebAudit) -> list[Rule]:
        is_retail = _category_matches(lead, RETAIL_CATEGORIES)
        return [
            ("Vende productos físicos (categoría de comercio)", 35 if is_retail else 0),
            ("Vende por redes sociales sin tienda online", 15 if is_retail and (lead.instagram or lead.facebook) else 0),
            *self._base_rules(lead),
        ]

    def _seo_rules(self, lead: Lead, audit: WebAudit) -> list[Rule]:
        reachable = bool(lead.website) and audit.website_reachable is True
        return [
            ("Tiene sitio web activo que se puede posicionar", 25 if reachable else 0),
            (
                "Le falta SEO básico (título o meta descripción)",
                25 if reachable and (audit.has_title is False or audit.has_meta_description is False) else 0,
            ),
            ("Pocas reseñas en Google: baja visibilidad", 10 if reachable and (lead.reviews_count or 0) < 50 else 0),
            *self._base_rules(lead),
        ]

    def _ads_rules(self, lead: Lead, audit: WebAudit) -> list[Rule]:
        has_site = bool(lead.website) and audit.website_reachable is not False
        return [
            ("Sector competitivo donde la pauta es rentable", 25 if _category_matches(lead, COMPETITIVE_CATEGORIES) else 0),
            ("Tiene sitio web para recibir tráfico pagado", 15 if has_site else 0),
            (
                "Le falta SEO básico: necesita pauta para aparecer",
                10 if has_site and (audit.has_title is False or audit.has_meta_description is False) else 0,
            ),
            *self._base_rules(lead),
        ]

    def _whatsapp_ai_rules(self, lead: Lead, audit: WebAudit) -> list[Rule]:
        reviews = lead.reviews_count or 0
        return [
            ("Sector con muchas consultas de clientes", 25 if _category_matches(lead, HIGH_INQUIRY_CATEGORIES) else 0),
            ("Alto volumen de clientes (100+ reseñas)", 10 if reviews >= 100 else 0),
            ("Tiene teléfono/WhatsApp para atender", 10 if lead.phone or lead.whatsapp else 0),
            # Solo cuenta si la auditoría lo confirmó; sin web la primera venta debe ser la página
            ("Su web no tiene chatbot ni atención automatizada", 10 if audit.has_chatbot is False else 0),
            *self._base_rules(lead),
        ]

    # --- Utilidades ------------------------------------------------------------------------

    @staticmethod
    def _build_result(
        rules: list[Rule], niche: str, service: JarvisService | None, show_price: bool = True
    ) -> LeadScoringResult:
        score = max(0, min(100, round(sum(points for _, points in rules))))
        level = "high" if score >= 70 else "medium" if score >= 40 else "low"
        return LeadScoringResult(
            score=score,
            level=level,
            reasons=[LeadScoringReason(description=description, points=round(points, 2)) for description, points in rules],
            calculated_at=datetime.now(timezone.utc),
            niche=niche,
            recommended_service=service.name if service else None,
            pitch=(f"Ofrecer {service.name} ({service.price})" if show_price else f"Ofrecer {service.name}")
            if service
            else None,
        )

    def _weighted_quality(
        self, lead: Lead, audit: WebAudit, weights: LeadScoringWeights, niche: str
    ) -> LeadScoringResult:
        normalized = weights.normalized()
        rules = [
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
        return self._build_result(rules, niche, None)
