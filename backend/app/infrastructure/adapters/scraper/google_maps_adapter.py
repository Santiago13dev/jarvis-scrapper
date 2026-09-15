"""
Adapter: GoogleMapsScraperAdapter — implementa ScraperProvider llamando al
servicio HTTP del gosom/google-maps-scraper en modo web (integrations/google-maps-scraper).

Flujo: POST /api/v1/jobs → poll GET /api/v1/jobs/{id} → GET /api/v1/jobs/{id}/download → parse CSV.
"""
from __future__ import annotations

import asyncio
import csv
import io
import logging
from pathlib import Path
from typing import Sequence

import httpx

from app.application.ports.scraper_provider import ScrapedBusiness, ScraperProvider, ScrapeQuery
from app.infrastructure.config.config import get_settings

logger = logging.getLogger(__name__)

POLL_INTERVAL = 3  # seconds between status checks
MAX_POLL_ATTEMPTS = 120  # ~6 minutes max wait


class GoogleMapsScraperAdapter(ScraperProvider):
    def __init__(self, base_url: str | None = None) -> None:
        settings = get_settings()
        self._base_url = (base_url or settings.scraper_api_url).rstrip("/")
        self._latitude = settings.scraper_latitude
        self._longitude = settings.scraper_longitude

    async def search(self, query: ScrapeQuery) -> Sequence[ScrapedBusiness]:
        keyword = f"{query.keyword} {query.location}"

        payload = {
            "Name": f"jarvisia-{query.keyword}",
            "keywords": [keyword],
            "lang": query.language or "es",
            "zoom": 15,
            "lat": str(self._latitude),
            "lon": str(self._longitude),
            "fast_mode": False,
            "radius": 10000,
            "depth": query.depth,
            "email": False,
            "max_time": 600,
            "proxies": [],
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{self._base_url}/api/v1/jobs", json=payload)
            resp.raise_for_status()
            job_id = resp.json()["id"]
            logger.info("Scraper job created: %s", job_id)

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
    def _parse_csv(csv_text: str) -> list[ScrapedBusiness]:
        reader = csv.DictReader(io.StringIO(csv_text))
        businesses: list[ScrapedBusiness] = []
        for row in reader:
            businesses.append(
                ScrapedBusiness(
                    name=row.get("title", "").strip(),
                    address=row.get("address") or None,
                    phone=row.get("phone") or None,
                    website=row.get("website") or None,
                    category=row.get("category") or None,
                    rating=float(row["review_rating"]) if row.get("review_rating") else None,
                    reviews_count=int(row["review_count"]) if row.get("review_count") else None,
                    latitude=float(row["latitude"]) if row.get("latitude") else None,
                    longitude=float(row["longitude"]) if row.get("longitude") else None,
                    raw_source_id=row.get("place_id") or row.get("cid") or None,
                )
            )
        return businesses
