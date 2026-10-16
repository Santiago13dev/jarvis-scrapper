"""
Port: ScraperProvider

Contrato que debe cumplir cualquier proveedor de scraping de empresas.
El adapter inicial invocará el repositorio externo gosom/google-maps-scraper
(integrations/google-maps-scraper) sin modificarlo.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class ScrapedBusiness:
    """DTO neutral, independiente del formato interno del scraper subyacente."""
    name: str
    address: str | None
    phone: str | None
    website: str | None
    category: str | None
    rating: float | None
    reviews_count: int | None
    latitude: float | None
    longitude: float | None
    raw_source_id: str | None  # id/place_id original, útil para deduplicación
    email: str | None = None
    emails: tuple[str, ...] = ()
    instagram: str | None = None
    facebook: str | None = None
    owner_name: str | None = None
    description: str | None = None
    permanently_closed: bool = False


@dataclass(frozen=True)
class ScrapeQuery:
    keyword: str
    location: str
    max_results: int = 100
    language: str | None = None
    depth: int = 1
    extract_emails: bool = True
    country: str = "CO"


class ScraperProvider(ABC):
    """Puerto que abstrae la fuente de datos de negocios locales."""

    @abstractmethod
    async def search(self, query: ScrapeQuery) -> Sequence[ScrapedBusiness]:
        """Ejecuta una búsqueda y devuelve resultados normalizados."""
        raise NotImplementedError

    @abstractmethod
    async def get_job_status(self, job_id: str) -> str:
        """Consulta el estado de un job de scraping asíncrono (pending/running/done/failed)."""
        raise NotImplementedError
