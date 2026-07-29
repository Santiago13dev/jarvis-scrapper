"""
Adapter: GoogleMapsScraperAdapter — implementa ScraperProvider invocando el repo externo
gosom/google-maps-scraper (integrations/google-maps-scraper) como proceso Docker/CLI.

Flujo (tal como se acordó): run scraper → esperar resultado → leer CSV → convertir a
ScrapedBusiness → retornar. Nunca se importa ni se modifica código del repo externo.
"""
from __future__ import annotations

import asyncio
import csv
import uuid
from pathlib import Path
from typing import Sequence

from app.application.ports.scraper_provider import ScrapedBusiness, ScraperProvider, ScrapeQuery
from app.infrastructure.config.config import get_settings

# Job en memoria para este ejemplo; en producción usar QueueProvider/CacheProvider
# para persistir estado entre requests y workers.
_JOBS: dict[str, str] = {}


class GoogleMapsScraperAdapter(ScraperProvider):
    def __init__(self, results_path: str | None = None) -> None:
        settings = get_settings()
        self._results_path = Path(results_path or settings.scraper_results_path)

    async def search(self, query: ScrapeQuery) -> Sequence[ScrapedBusiness]:
        job_id = str(uuid.uuid4())
        _JOBS[job_id] = "running"

        output_file = self._results_path / f"{job_id}.csv"
        self._results_path.mkdir(parents=True, exist_ok=True)

        cmd = [
            "docker", "compose", "--profile", "scraper", "run", "--rm",
            "google-maps-scraper",
            "-input", f"{query.keyword} {query.location}",
            "-results", str(output_file),
            "-depth", "1",
            "-lang", query.language or "es",
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await process.communicate()

        if process.returncode != 0:
            _JOBS[job_id] = "failed"
            raise RuntimeError(f"google-maps-scraper falló: {stderr.decode(errors='ignore')}")

        _JOBS[job_id] = "done"
        results = self._read_csv(output_file)
        return results[: query.max_results]

    async def get_job_status(self, job_id: str) -> str:
        return _JOBS.get(job_id, "not_found")

    def _read_csv(self, path: Path) -> list[ScrapedBusiness]:
        if not path.exists():
            return []

        businesses: list[ScrapedBusiness] = []
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                businesses.append(
                    ScrapedBusiness(
                        name=row.get("title", "").strip(),
                        address=row.get("address") or None,
                        phone=row.get("phone") or None,
                        website=row.get("website") or None,
                        category=row.get("category") or None,
                        rating=float(row["rating"]) if row.get("rating") else None,
                        reviews_count=int(row["reviews_count"]) if row.get("reviews_count") else None,
                        latitude=float(row["latitude"]) if row.get("latitude") else None,
                        longitude=float(row["longitude"]) if row.get("longitude") else None,
                        raw_source_id=row.get("place_id") or row.get("cid") or None,
                    )
                )
        return businesses
