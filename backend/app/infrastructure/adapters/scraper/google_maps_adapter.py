"""
Adapter: GoogleMapsScraperAdapter — implementa ScraperProvider llamando al
servicio HTTP del gosom/google-maps-scraper en modo web (integrations/google-maps-scraper).

Flujo: geocodificar ubicación → POST /api/v1/jobs → poll GET /api/v1/jobs/{id}
→ GET /api/v1/jobs/{id}/download → parse CSV.
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import re
from typing import Sequence
from urllib.parse import urlsplit

import httpx

from app.application.ports.scraper_provider import ScrapedBusiness, ScraperProvider, ScrapeQuery
from app.domain.countries import get_country
from app.infrastructure.config.config import get_settings

logger = logging.getLogger(__name__)

POLL_INTERVAL = 3  # seconds between status checks
MAX_POLL_ATTEMPTS = 300  # ~15 minutes max wait (la extracción de emails visita cada sitio web)
JOB_MAX_TIME_SECONDS = 900
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# Falsos positivos típicos al extraer emails del HTML (assets, plataformas, plantillas)
EMAIL_JUNK_MARKERS = (
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    "sentry", "wixpress", "example.", "domain.com", "email.com", "tudominio", "yourdomain",
)
PERMANENTLY_CLOSED_MARKERS = ("permanently closed", "closed permanently", "cerrado permanentemente", "cerrado definitivamente")
INSTAGRAM_DOMAINS = ("instagram.com",)
FACEBOOK_DOMAINS = ("facebook.com", "fb.com", "fb.me")
# Dominios que Google Maps acepta como "sitio web" pero no son una página propia del negocio
NON_WEBSITE_DOMAINS = (
    "wa.me", "whatsapp.com", "linktr.ee", "linktree.com", "beacons.ai", "tiktok.com",
    "sites.google.com", "business.site", "rappi.com", "ifood.com", "didi-food.com",
)


class GoogleMapsScraperAdapter(ScraperProvider):
    def __init__(self, base_url: str | None = None) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.scraper_api_url).rstrip("/")
        self._latitude = settings.scraper_latitude
        self._longitude = settings.scraper_longitude
        self._geocode_cache: dict[str, tuple[float, float]] = {}

    async def search(self, query: ScrapeQuery) -> Sequence[ScrapedBusiness]:
        country = get_country(query.country)
        location = self._with_country(query.location, country.name)
        keyword = f"{query.keyword} {location}"
        latitude, longitude = await self._resolve_coordinates(location, country.code)

        payload = {
            "Name": f"jarvisia-{query.keyword}",
            "keywords": [keyword],
            "lang": query.language or country.language,
            "zoom": 15,
            "lat": str(latitude),
            "lon": str(longitude),
            "fast_mode": False,
            "radius": 10000,
            "depth": query.depth,
            "email": query.extract_emails,
            "max_time": JOB_MAX_TIME_SECONDS,
            "proxies": [],
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{self._base_url}/api/v1/jobs", json=payload)
            resp.raise_for_status()
            job_id = resp.json()["id"]
            logger.info("Scraper job created: %s (%s @ %s,%s)", job_id, keyword, latitude, longitude)

            # Poll until completed or failed
            for attempt in range(MAX_POLL_ATTEMPTS):
                await asyncio.sleep(POLL_INTERVAL)
                status_resp = await client.get(f"{self._base_url}/api/v1/jobs/{job_id}")
                status_resp.raise_for_status()
                job = status_resp.json()
                status = job.get("Status", "")

                if status == "ok":
                    logger.info("Scraper job %s completed", job_id)
                    break
                if status == "failed":
                    raise RuntimeError(f"Scraper job {job_id} failed")
            else:
                raise RuntimeError(f"Scraper job {job_id} timed out after {MAX_POLL_ATTEMPTS * POLL_INTERVAL}s")

            # Download CSV results
            csv_resp = await client.get(f"{self._base_url}/api/v1/jobs/{job_id}/download")
            csv_resp.raise_for_status()

        return self._parse_csv(csv_resp.text)[: query.max_results]

    async def get_job_status(self, job_id: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self._base_url}/api/v1/jobs/{job_id}")
            if resp.status_code == 404:
                return "not_found"
            resp.raise_for_status()
            return resp.json().get("Status", "unknown")

    @staticmethod
    def _with_country(location: str, country_name: str) -> str:
        """Evita ambigüedades como Valencia (España/Venezuela) agregando el país si no viene en el texto."""
        location = location.strip()
        if not location:
            return country_name
        return location if country_name.lower() in location.lower() else f"{location}, {country_name}"

    async def _resolve_coordinates(self, location: str, country_code: str = "CO") -> tuple[float, float]:
        """Centra la búsqueda en la ubicación pedida; si no se puede geocodificar usa el centro del país."""
        country = get_country(country_code)
        fallback = (self._latitude, self._longitude) if country.code == "CO" else (country.latitude, country.longitude)
        key = f"{country.code}:{location.strip().lower()}"
        if key in self._geocode_cache:
            return self._geocode_cache[key]
        try:
            async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "JarvisIA-LeadFinder/1.0"}) as client:
                resp = await client.get(
                    NOMINATIM_URL,
                    params={"q": location, "format": "json", "limit": 1, "countrycodes": country.code.lower()},
                )
                resp.raise_for_status()
                results = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("No se pudo geocodificar '%s': %s", location, exc)
            return fallback
        if not results:
            logger.warning("Ubicación '%s' no encontrada; se usan coordenadas por defecto", location)
            return fallback
        coordinates = (float(results[0]["lat"]), float(results[0]["lon"]))
        self._geocode_cache[key] = coordinates
        return coordinates

    @classmethod
    def _parse_csv(cls, csv_text: str) -> list[ScrapedBusiness]:
        reader = csv.DictReader(io.StringIO(csv_text))
        businesses: list[ScrapedBusiness] = []
        for row in reader:
            website, instagram, facebook = cls._classify_website(row.get("website"))
            businesses.append(
                ScrapedBusiness(
                    name=row.get("title", "").strip(),
                    address=row.get("address") or None,
                    phone=row.get("phone") or None,
                    website=website,
                    category=row.get("category") or None,
                    rating=float(row["review_rating"]) if row.get("review_rating") else None,
                    reviews_count=int(row["review_count"]) if row.get("review_count") else None,
                    latitude=float(row["latitude"]) if row.get("latitude") else None,
                    longitude=float(row["longitude"]) if row.get("longitude") else None,
                    raw_source_id=row.get("place_id") or row.get("cid") or None,
                    emails=cls._parse_emails(row.get("emails")),
                    instagram=instagram,
                    facebook=facebook,
                    owner_name=cls._parse_owner_name(row.get("owner")),
                    description=(row.get("descriptions") or "").strip() or None,
                    permanently_closed=any(
                        marker in (row.get("status") or "").lower() for marker in PERMANENTLY_CLOSED_MARKERS
                    ),
                )
            )
        return businesses

    @staticmethod
    def _classify_website(raw: str | None) -> tuple[str | None, str | None, str | None]:
        """Separa redes sociales y enlaces genéricos de una página web propia. Devuelve (website, instagram, facebook)."""
        url = (raw or "").strip()
        if not url:
            return None, None, None
        host = (urlsplit(url if "://" in url else f"https://{url}").hostname or "").lower()

        def matches(domains: tuple[str, ...]) -> bool:
            return any(host == domain or host.endswith(f".{domain}") for domain in domains)

        if matches(INSTAGRAM_DOMAINS):
            return None, url, None
        if matches(FACEBOOK_DOMAINS):
            return None, None, url
        if matches(NON_WEBSITE_DOMAINS):
            return None, None, None
        return url, None, None

    @staticmethod
    def _parse_emails(raw: str | None) -> tuple[str, ...]:
        found: list[str] = []
        for email in EMAIL_PATTERN.findall(raw or ""):
            email = email.lower().strip(".")
            if any(marker in email for marker in EMAIL_JUNK_MARKERS) or email in found:
                continue
            found.append(email)
        return tuple(found)

    @staticmethod
    def _parse_owner_name(raw: str | None) -> str | None:
        if not raw:
            return None
        try:
            owner = json.loads(raw)
        except ValueError:
            return None
        name = owner.get("name") if isinstance(owner, dict) else None
        return name.strip() if isinstance(name, str) and name.strip() else None
