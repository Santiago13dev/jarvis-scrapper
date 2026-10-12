"""
Servicio de dominio: preparación del contacto con un lead.

- Variables para las plantillas de mensaje ({{negocio}}, {{categoria}}…).
- Enlace de WhatsApp (wa.me) con el mensaje ya escrito: la persona solo da «enviar».
- Prioridad de la lista diaria de contacto.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import quote

from app.domain.entities.lead import Lead, LeadStatus

DEFAULT_MESSAGE = (
    "Hola, ¿qué tal? Vi {{negocio}} en Google Maps ({{calificacion}} ⭐ con {{resenas}} reseñas) "
    "y me encantó. Noté que {{oportunidad}}. Ayudamos a negocios como el tuyo a conseguir más "
    "clientes desde internet. ¿Te puedo mostrar una idea en 2 minutos?"
)

OPPORTUNITY_PHRASES = {
    "No tiene página web propia": "todavía no tienen página web propia",
    "Su web es un sitio gratuito": "su página está en una plataforma gratuita",
    "Su sitio no usa HTTPS": "su página aparece como «no segura» en el navegador",
    "Su sitio no carga": "su página no está cargando",
    "Su sitio no está adaptado a celulares": "su página no se ve bien en celulares",
    "A su sitio le falta título": "su página casi no aparece en Google",
    "Su sitio tarda": "su página tarda en cargar",
}


def city_from_address(address: str | None) -> str:
    """'Ak 7 #60A - 54, Chapinero, Bogotá, Cundinamarca' → 'Bogotá'."""
    if not address:
        return ""
    parts = [part.strip() for part in address.split(",") if part.strip()]
    departments = {"cundinamarca", "antioquia", "valle del cauca", "atlántico", "atlantico", "santander", "colombia"}
    for part in reversed(parts):
        cleaned = re.sub(r"\d+", "", part).strip()
        if cleaned and cleaned.lower() not in departments and not re.search(r"#|\bcra\b|\bcl\b|\bak\b|\bac\b", part.lower()):
            return cleaned
    return ""


def main_opportunity(lead: Lead) -> str:
    """Frase natural con la oportunidad de venta más fuerte según el puntaje."""
    for reason in sorted(lead.score_reasons or [], key=lambda r: -float(r.get("points", 0) or 0)):
        if float(reason.get("points", 0) or 0) <= 0:
            continue
        description = str(reason.get("description", ""))
        for prefix, phrase in OPPORTUNITY_PHRASES.items():
            if description.startswith(prefix):
                return phrase
    return "podrían aprovechar mejor internet para atraer clientes"


def template_values(lead: Lead) -> dict[str, str]:
    rating = f"{lead.rating:.1f}".replace(".", ",") if lead.rating else ""
    values = {
        "negocio": lead.name,
        "lead_name": lead.name,  # compatibilidad con plantillas anteriores
        "categoria": (lead.category or "").lower(),
        "ciudad": city_from_address(lead.address),
        "calificacion": rating,
        "resenas": str(lead.reviews_count or 0),
        "oportunidad": main_opportunity(lead),
    }
    return values


def render_message(content: str, lead: Lead) -> str:
    text = content
    for key, value in template_values(lead).items():
        text = re.sub(r"\{\{\s*" + re.escape(key) + r"\s*\}\}", value, text)
    # Limpia restos si alguna variable vino vacía: «( ⭐ con 0 reseñas)».
    text = text.replace("( ⭐ con 0 reseñas)", "").replace("  ", " ").strip()
    return text


def whatsapp_link(lead: Lead, message: str) -> str | None:
    number = re.sub(r"\D", "", lead.whatsapp or "")
    if len(number) < 10:
        return None
    return f"https://wa.me/{number}?text={quote(message)}"


def priority(lead: Lead, now: datetime | None = None) -> float:
    """Orden de la lista diaria: mejor puntaje primero; los recién contactados esperan."""
    now = now or datetime.now(timezone.utc)
    score = lead.score.value if lead.score else 0
    if lead.last_contacted_at is not None:
        days = (now - lead.last_contacted_at).days
        score -= max(0, 30 - days)  # penaliza contactos recientes
    return score


OPT_OUT_PATTERNS = (
    r"\bno\s+(me\s+)?interesa",
    r"\bno\s+gracias\b",
    r"\bno\s+(me\s+)?(escrib|contact|molest|llam)",
    r"\b(dejen?|deja)\s+de\s+(escribir|molestar|enviar)",
    r"^\s*(stop|baja)\s*[.!]*\s*$",
    r"\b(unsubscribe|cancelar\s+suscripci)",
    r"\bbor(ren|ra)\s+mi\s+n[uú]mero",
)


def is_opt_out(text: str) -> bool:
    """¿El mensaje pide no volver a ser contactado? (Habeas data / buenas prácticas)."""
    normalized = text.lower().strip()
    return any(re.search(pattern, normalized) for pattern in OPT_OUT_PATTERNS)


def is_contactable(lead: Lead) -> bool:
    return not lead.do_not_contact and bool(lead.whatsapp) and lead.status in (LeadStatus.NEW, LeadStatus.CONTACTED)
