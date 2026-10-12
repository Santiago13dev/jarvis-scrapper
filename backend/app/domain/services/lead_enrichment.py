"""
Servicio de dominio: enriquecimiento de leads.

Limpia y completa lo que llega del scraper sin consultar servicios externos:
- Teléfono en formato internacional (E.164) y detección de celulares colombianos,
  que en la práctica casi siempre tienen WhatsApp.
- Clasificación del "sitio web": propio, red social o directorio. Google Maps muchas
  veces muestra un Instagram o una ficha de Restaurant Guru como si fuera la web del
  negocio; para una agencia, ese negocio en realidad NO tiene página propia.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlparse

from app.domain.entities.lead import Lead


class WebsiteKind(str, Enum):
    OWN = "own"            # dominio propio del negocio
    SOCIAL = "social"      # Instagram, Facebook, TikTok, Linktree…
    DIRECTORY = "directory"  # Restaurant Guru, Tripadvisor, Rappi…
    NONE = "none"


SOCIAL_DOMAINS = {
    "instagram.com": "instagram",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "fb.me": "facebook",
    "m.facebook.com": "facebook",
    "tiktok.com": "tiktok",
    "linktr.ee": "linktree",
    "linkin.bio": "linktree",
    "beacons.ai": "linktree",
    "wa.me": "whatsapp",
    "api.whatsapp.com": "whatsapp",
    "whatsapp.com": "whatsapp",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "youtube.com": "youtube",
}

DIRECTORY_DOMAINS = {
    "restaurantguru.com",
    "tripadvisor.com",
    "tripadvisor.co",
    "rappi.com",
    "rappi.com.co",
    "didi-food.com",
    "ifood.com.co",
    "domicilios.com",
    "paginasamarillas.com.co",
    "foursquare.com",
    "yelp.com",
    "google.com",
    "goo.gl",
    "maps.app.goo.gl",
    "g.page",
    "uber.com",
    "ubereats.com",
    "pedidosya.com",
    "cylex.com.co",
    "infoisinfo.com.co",
    "guiacolombia.com",
}

# Subdominios gratuitos: el negocio tiene "algo", pero no un sitio profesional.
FREE_SITE_SUFFIXES = (".wixsite.com", ".blogspot.com", ".business.site", ".negocio.site", ".godaddysites.com", ".webnode.com.co", ".jimdosite.com")


@dataclass(frozen=True)
class LeadEnrichment:
    phone_e164: str | None
    whatsapp: str | None          # solo dígitos con indicativo, listo para wa.me
    is_mobile: bool
    website_kind: WebsiteKind
    own_website: str | None       # sitio propio (si lo hay)
    instagram: str | None
    facebook: str | None
    listing_url: str | None       # ficha en directorio o red social no clasificada
    free_subdomain: bool          # sitio en Wix/Blogspot/business.site gratuito


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def normalize_phone(raw: str | None, default_country_code: str = "57") -> tuple[str | None, bool]:
    """
    Devuelve (E.164 sin '+', es_celular). Pensado para Colombia (+57):
    - Celular: 10 dígitos que empiezan por 3.
    - Fijo nuevo (desde 2021): 10 dígitos que empiezan por 60.
    - Fijo antiguo de 7 dígitos: se asume Bogotá (601).
    """
    if not raw:
        return None, False
    digits = _digits(raw)
    if not digits:
        return None, False
    if digits.startswith("00"):
        digits = digits[2:]
    if default_country_code == "57":
        if digits.startswith("57") and len(digits) == 12:
            digits = digits[2:]
        if len(digits) == 10 and digits.startswith("3"):
            return f"57{digits}", True
        if len(digits) == 10 and digits.startswith("60"):
            return f"57{digits}", False
        if len(digits) == 7:
            return f"57601{digits}", False
        if len(digits) > 10:
            return digits, False  # ya trae otro indicativo
        return None, False
    return (digits if digits.startswith(default_country_code) else f"{default_country_code}{digits}"), False


def _host(url: str) -> str:
    candidate = url.strip()
    if not re.match(r"^[a-z][a-z0-9+.-]*://", candidate, re.IGNORECASE):
        candidate = f"https://{candidate}"
    host = (urlparse(candidate).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _matches(host: str, domain: str) -> bool:
    return host == domain or host.endswith(f".{domain}")


def classify_website(url: str | None) -> tuple[WebsiteKind, str | None]:
    """Devuelve el tipo de enlace y, para redes sociales, cuál (instagram, facebook…)."""
    if not url or not url.strip():
        return WebsiteKind.NONE, None
    host = _host(url)
    if not host:
        return WebsiteKind.NONE, None
    for domain, network in SOCIAL_DOMAINS.items():
        if _matches(host, domain):
            return WebsiteKind.SOCIAL, network
    if host.endswith(FREE_SITE_SUFFIXES):
        return WebsiteKind.OWN, "free"
    for domain in DIRECTORY_DOMAINS:
        if _matches(host, domain):
            return WebsiteKind.DIRECTORY, None
    return WebsiteKind.OWN, None


def _clean_url(url: str) -> str:
    url = url.strip()
    if not re.match(r"^[a-z][a-z0-9+.-]*://", url, re.IGNORECASE):
        url = f"https://{url}"
    # Quita parámetros de seguimiento (?utm_...), que ensucian el enlace.
    return re.sub(r"[?&]utm_[^&#]*", "", url).rstrip("?&")


def enrich(lead: Lead, default_country_code: str = "57") -> LeadEnrichment:
    phone_e164, is_mobile = normalize_phone(lead.phone or lead.whatsapp, default_country_code)
    whatsapp = lead.whatsapp and _digits(lead.whatsapp) or (phone_e164 if is_mobile else None)

    instagram, facebook, listing = lead.instagram, lead.facebook, None
    own_website: str | None = None
    kind, detail = classify_website(lead.website)
    free_subdomain = False
    if kind is WebsiteKind.OWN:
        own_website = _clean_url(lead.website or "")
        free_subdomain = detail == "free"
    elif kind is WebsiteKind.SOCIAL:
        url = _clean_url(lead.website or "")
        if detail == "instagram":
            instagram = instagram or url
        elif detail == "facebook":
            facebook = facebook or url
        elif detail == "whatsapp":
            whatsapp = whatsapp or (_digits(url) or None)
        else:
            listing = url
    elif kind is WebsiteKind.DIRECTORY:
        listing = _clean_url(lead.website or "")

    return LeadEnrichment(
        phone_e164=phone_e164,
        whatsapp=whatsapp or None,
        is_mobile=is_mobile,
        website_kind=kind,
        own_website=own_website,
        instagram=instagram,
        facebook=facebook,
        listing_url=listing,
        free_subdomain=free_subdomain,
    )


def apply_enrichment(lead: Lead, default_country_code: str = "57") -> LeadEnrichment:
    """Aplica el enriquecimiento sobre el lead (idempotente)."""
    result = enrich(lead, default_country_code)
    lead.whatsapp = result.whatsapp
    lead.instagram = result.instagram
    lead.facebook = result.facebook
    lead.website = result.own_website
    if result.listing_url:
        lead.listing_url = result.listing_url
    for tag, present in (
        ("sin-web", result.own_website is None),
        ("solo-redes", result.own_website is None and bool(result.instagram or result.facebook)),
        ("web-gratuita", result.free_subdomain),
        ("whatsapp", bool(result.whatsapp)),
    ):
        if present:
            lead.add_tag(tag)
        elif tag in lead.tags:
            lead.tags.remove(tag)
    return result
