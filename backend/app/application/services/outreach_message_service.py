"""
Genera el primer mensaje y el seguimiento para cada lead a partir de lo que Jarvis detectó:
servicio recomendado, reseñas, rating, redes y fallas del sitio web. Determinista (sin IA)
para que funcione siempre; el texto se puede editar antes de aprobarlo.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.countries import get_country
from app.domain.entities.lead import Lead

OPT_OUT_WORDS = {"no", "stop", "baja", "no gracias", "no me interesa", "unsubscribe", "no thanks", "no interesa"}


@dataclass(frozen=True)
class Voice:
    """Registro del mensaje por país: usted (CO), tú (ES) o inglés (US)."""
    greeting: str
    saw_profile: str
    reputation: str
    no_website: str
    social_only: str
    site_down: str
    site_weak: str
    retail: str
    seo_gap: str
    ads: str
    whatsapp_ai: str
    offers: dict[str, str]
    cta: str
    opt_out: str
    signature: str
    follow_up: str


VOICES: dict[str, Voice] = {
    "usted": Voice(
        greeting="Hola, {name} 👋",
        saw_profile="Encontré su negocio en Google Maps",
        reputation=" y vi que tienen {rating}⭐ con {reviews} reseñas, ¡excelente reputación!",
        no_website="Noté que todavía no tienen página web propia",
        social_only=", solo {network}",
        site_down="Intenté entrar a su página web y no está cargando, así que es posible que estén perdiendo clientes",
        site_weak="Revisé su página web y tiene detalles que espantan clientes (no es segura o no se ve bien en celular)",
        retail="Vi que venden sus productos por redes y por WhatsApp, pero no tienen una tienda online donde puedan pagar directo",
        seo_gap="Revisé su página web y a Google le falta información clave para mostrarla en las búsquedas",
        ads="En su sector la competencia en Google es fuerte y quien aparece primero se lleva los clientes",
        whatsapp_ai="Con tantos clientes imagino que les llegan muchas consultas por WhatsApp y no siempre alcanzan a responder todas a tiempo",
        offers={
            "landing": "En Jarvis IA creamos landing pages rápidas, con botón de WhatsApp, que convierten visitas en clientes",
            "web": "En Jarvis IA diseñamos páginas web profesionales, optimizadas para Google y para celular",
            "ecommerce": "En Jarvis IA montamos tiendas virtuales con carrito y pagos en línea, listas para vender 24/7",
            "seo": "En Jarvis IA hacemos posicionamiento SEO para que su negocio aparezca cuando lo buscan en Google",
            "ads": "En Jarvis IA combinamos SEO y Google Ads para que lleguen clientes desde la primera semana",
            "whatsapp_ai": "En Jarvis IA creamos un asistente con IA para WhatsApp que responde 24/7, agenda y califica clientes",
        },
        cta="¿Le puedo mostrar un ejemplo para {category} sin ningún compromiso?",
        opt_out="Si no le interesa, responda NO y no le vuelvo a escribir.",
        signature="— Equipo Jarvis IA",
        follow_up=(
            "Hola de nuevo, {name}. Le escribí hace unos días sobre {service}. "
            "Si le interesa, le preparo una propuesta sin compromiso en 24 horas. ¿Le parece? 🙌"
        ),
    ),
    "tu": Voice(
        greeting="¡Hola, {name}! 👋",
        saw_profile="He visto vuestro negocio en Google Maps",
        reputation=" y tenéis {rating}⭐ con {reviews} reseñas, ¡enhorabuena!",
        no_website="Me he dado cuenta de que todavía no tenéis página web propia",
        social_only=", solo {network}",
        site_down="He intentado entrar en vuestra web y no carga, así que podéis estar perdiendo clientes",
        site_weak="He revisado vuestra web y tiene detalles que espantan clientes (no es segura o no se ve bien en el móvil)",
        retail="He visto que vendéis por redes y por WhatsApp, pero no tenéis una tienda online donde pagar directamente",
        seo_gap="He revisado vuestra web y a Google le falta información clave para mostrarla en las búsquedas",
        ads="En vuestro sector la competencia en Google es fuerte y quien sale primero se lleva los clientes",
        whatsapp_ai="Con tantos clientes imagino que os llegan muchísimas consultas por WhatsApp y no siempre dais abasto",
        offers={
            "landing": "En Jarvis IA creamos landing pages rápidas, con botón de WhatsApp, que convierten visitas en clientes",
            "web": "En Jarvis IA diseñamos webs profesionales, optimizadas para Google y para móvil",
            "ecommerce": "En Jarvis IA montamos tiendas online con carrito y pago, listas para vender 24/7",
            "seo": "En Jarvis IA hacemos posicionamiento SEO para que aparezcáis cuando os buscan en Google",
            "ads": "En Jarvis IA combinamos SEO y Google Ads para atraer clientes desde la primera semana",
            "whatsapp_ai": "En Jarvis IA creamos un asistente con IA para WhatsApp que responde 24/7, agenda y cualifica clientes",
        },
        cta="¿Te enseño un ejemplo para {category} sin compromiso?",
        opt_out="Si no os interesa, responde NO y no vuelvo a escribir.",
        signature="— Equipo Jarvis IA",
        follow_up=(
            "¡Hola de nuevo, {name}! Os escribí hace unos días sobre {service}. "
            "Si os interesa, os preparo una propuesta sin compromiso en 24 horas. ¿Qué te parece? 🙌"
        ),
    ),
    "en": Voice(
        greeting="Hi {name} 👋",
        saw_profile="I came across your business on Google Maps",
        reputation=" and saw your {rating}⭐ rating from {reviews} reviews. Great reputation!",
        no_website="I noticed you don't have your own website yet",
        social_only=", only {network}",
        site_down="I tried to visit your website and it isn't loading, so you may be losing customers",
        site_weak="I checked your website and found issues that drive customers away (not secure or not mobile friendly)",
        retail="I saw you sell through social media and WhatsApp, but there's no online store where customers can pay directly",
        seo_gap="I checked your website and Google is missing key information to show it in search results",
        ads="Competition on Google in your industry is tough, and whoever shows up first gets the customers",
        whatsapp_ai="With so many customers, I imagine you get a lot of WhatsApp inquiries and can't always answer them in time",
        offers={
            "landing": "At Jarvis IA we build fast landing pages with a WhatsApp button that turn visitors into customers",
            "web": "At Jarvis IA we design professional websites optimized for Google and mobile",
            "ecommerce": "At Jarvis IA we build online stores with cart and payments, ready to sell 24/7",
            "seo": "At Jarvis IA we do SEO so your business shows up when people search on Google",
            "ads": "At Jarvis IA we combine SEO and Google Ads to bring customers from week one",
            "whatsapp_ai": "At Jarvis IA we build an AI WhatsApp assistant that replies 24/7, books appointments and qualifies leads",
        },
        cta="Could I show you a quick example for a {category}? No commitment.",
        opt_out="If you're not interested, reply STOP and I won't message again.",
        signature="— The Jarvis IA team",
        follow_up=(
            "Hi again {name}! I reached out a few days ago about {service}. "
            "If you're interested, I can put together a no-commitment proposal within 24 hours. Sound good? 🙌"
        ),
    ),
}

SERVICE_NAMES = {
    "es": {
        "landing": "una landing page", "web": "una página web", "ecommerce": "una tienda virtual",
        "seo": "posicionamiento en Google", "ads": "SEO y Google Ads", "whatsapp_ai": "un asistente IA para WhatsApp",
    },
    "en": {
        "landing": "a landing page", "web": "a website", "ecommerce": "an online store",
        "seo": "Google SEO", "ads": "SEO and Google Ads", "whatsapp_ai": "an AI WhatsApp assistant",
    },
}


def _voice_for(lead: Lead) -> tuple[Voice, str]:
    country = get_country(lead.country)
    if country.language == "en":
        return VOICES["en"], "en"
    return (VOICES["tu"] if country.code == "ES" else VOICES["usted"]), "es"


def _short_name(name: str) -> str:
    # "Clínica Dental Sonrisa - Sede Norte | Odontología" → "Clínica Dental Sonrisa"
    for separator in (" | ", " - ", " – ", ","):
        name = name.split(separator)[0]
    return name.strip()


def _has_reason(lead: Lead, fragment: str) -> bool:
    return any(fragment in str(reason.get("description", "")) and reason.get("points", 0) for reason in lead.score_reasons)


class OutreachMessageService:
    def first_touch(self, lead: Lead, signature: str | None = None) -> str:
        voice, language = _voice_for(lead)
        service = lead.score_niche if lead.score_niche in voice.offers else "web"
        name = _short_name(lead.name)

        opening = voice.saw_profile
        if lead.rating and lead.rating >= 4.0 and (lead.reviews_count or 0) >= 10:
            rating = f"{lead.rating:.1f}".replace(".", "," if language == "es" else ".")
            opening += voice.reputation.format(rating=rating, reviews=lead.reviews_count)
        else:
            opening += "."

        problem = self._problem(lead, voice, service)
        category = (lead.category or ("your business" if language == "en" else "su negocio")).lower()
        if language == "es" and lead.country == "ES":
            category = (lead.category or "vuestro negocio").lower()

        parts = [
            voice.greeting.format(name=name),
            opening,
            f"{problem}. {voice.offers[service]}.",
            voice.cta.format(category=category),
            voice.opt_out,
            signature or voice.signature,
        ]
        return "\n\n".join(part for part in parts if part)

    def follow_up(self, lead: Lead) -> str:
        voice, language = _voice_for(lead)
        service = lead.score_niche if lead.score_niche in SERVICE_NAMES[language] else "web"
        return voice.follow_up.format(name=_short_name(lead.name), service=SERVICE_NAMES[language][service])

    @staticmethod
    def is_opt_out(text: str) -> bool:
        return text.strip().lower().strip(".!¡ ") in OPT_OUT_WORDS

    @staticmethod
    def _problem(lead: Lead, voice: Voice, service: str) -> str:
        if service in ("landing", "web"):
            if not lead.website:
                network = "Instagram" if lead.instagram else "Facebook" if lead.facebook else None
                return voice.no_website + (voice.social_only.format(network=network) if network else "")
            if _has_reason(lead, "caído"):
                return voice.site_down
            return voice.site_weak
        return {
            "ecommerce": voice.retail,
            "seo": voice.seo_gap,
            "ads": voice.ads,
            "whatsapp_ai": voice.whatsapp_ai,
        }[service]
