from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import time
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from app.application.dto.website_audit_dto import WebsiteAuditResult


MAX_CONTENT_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 3
TIMEOUT_SECONDS = 8.0


class WebsiteAuditError(ValueError):
    pass


class WebsiteAuditService:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    async def audit(self, url: str) -> WebsiteAuditResult:
        current_url = self._validate_url(url)
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(
            timeout=httpx.Timeout(TIMEOUT_SECONDS),
            follow_redirects=False,
            trust_env=False,
            headers={"User-Agent": "JarvisIA-WebsiteAudit/1.0"},
        )
        redirect_count = 0
        started_at = time.perf_counter()

        try:
            while True:
                await self._validate_host(current_url)
                async with client.stream("GET", current_url, follow_redirects=False) as response:
                    if response.is_redirect:
                        if redirect_count >= MAX_REDIRECTS:
                            raise WebsiteAuditError("Se excedió el máximo de 3 redirecciones")
                        location = response.headers.get("location")
                        if not location:
                            raise WebsiteAuditError("La redirección no contiene destino")
                        current_url = self._validate_url(urljoin(current_url, location))
                        redirect_count += 1
                        continue

                    content = await self._read_limited(response)
                    response_time_ms = round((time.perf_counter() - started_at) * 1000)
                    return self._extract(
                        requested_url=url,
                        final_url=current_url,
                        status_code=response.status_code,
                        content=content,
                        response_time_ms=response_time_ms,
                    )
        except httpx.TimeoutException as exc:
            raise WebsiteAuditError("La auditoría excedió el timeout de 8 segundos") from exc
        except httpx.HTTPError as exc:
            raise WebsiteAuditError(f"No se pudo auditar el sitio web: {exc}") from exc
        finally:
            if owns_client:
                await client.aclose()

    @staticmethod
    async def _read_limited(response: httpx.Response) -> bytes:
        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_CONTENT_BYTES:
            raise WebsiteAuditError("El contenido supera el máximo de 2 MB")

        chunks: list[bytes] = []
        total = 0
        async for chunk in response.aiter_bytes():
            total += len(chunk)
            if total > MAX_CONTENT_BYTES:
                raise WebsiteAuditError("El contenido supera el máximo de 2 MB")
            chunks.append(chunk)
        return b"".join(chunks)

    @staticmethod
    def _validate_url(url: str) -> str:
        parsed = urlsplit(url)
        if parsed.scheme.lower() not in {"http", "https"}:
            raise WebsiteAuditError("Solo se permiten URLs HTTP y HTTPS")
        if not parsed.hostname:
            raise WebsiteAuditError("La URL no contiene un hostname válido")
        if parsed.username or parsed.password:
            raise WebsiteAuditError("Las URLs con credenciales no están permitidas")
        return url

    @staticmethod
    async def _validate_host(url: str) -> None:
        hostname = urlsplit(url).hostname
        if hostname is None:
            raise WebsiteAuditError("Hostname inválido")
        try:
            addresses = await asyncio.to_thread(
                socket.getaddrinfo,
                hostname,
                urlsplit(url).port or (443 if urlsplit(url).scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
        except socket.gaierror as exc:
            raise WebsiteAuditError("No se pudo resolver el hostname") from exc

        resolved_ips = {item[4][0] for item in addresses}
        for address in resolved_ips:
            ip = ipaddress.ip_address(address)
            if any((ip.is_private, ip.is_loopback, ip.is_link_local, ip.is_reserved, ip.is_unspecified, ip.is_multicast)):
                raise WebsiteAuditError("El destino apunta a una IP privada o local")

    @classmethod
    def _extract(
        cls,
        requested_url: str,
        final_url: str,
        status_code: int,
        content: bytes,
        response_time_ms: int,
    ) -> WebsiteAuditResult:
        soup = BeautifulSoup(content, "html.parser")
        final_base = final_url

        def links_matching(predicate) -> list[str]:
            return [
                urljoin(final_base, href)
                for href in (tag.get("href") for tag in soup.select("a[href]"))
                if href and predicate(href.lower())
            ]

        phone_links = links_matching(lambda href: href.startswith("tel:"))
        whatsapp_links = links_matching(
            lambda href: any(value in href for value in ("wa.me", "whatsapp.com", "api.whatsapp"))
        )
        booking_links = links_matching(
            lambda href: any(value in href for value in ("agenda", "booking", "reservation", "reservar", "cita"))
        )
        social_domains = (
            "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "youtube.com"
        )
        social_links = links_matching(lambda href: any(domain in href for domain in social_domains))
        chatbot_widgets = cls._find_chatbots(soup)
        emails = cls._find_emails(soup)
        meta_description = soup.find("meta", attrs={"name": lambda value: value and value.lower() == "description"})
        viewport = soup.find("meta", attrs={"name": lambda value: value and value.lower() == "viewport"})
        title = soup.title.get_text(" ", strip=True) if soup.title else None

        return WebsiteAuditResult(
            url=requested_url,
            final_url=final_url,
            status_code=status_code,
            https=urlsplit(final_url).scheme.lower() == "https",
            meta_viewport=viewport is not None,
            title=title or None,
            meta_description=meta_description.get("content") if meta_description else None,
            phone_links=phone_links,
            whatsapp_links=whatsapp_links,
            forms=len(soup.find_all("form")),
            booking_links=booking_links,
            chatbot_widgets=chatbot_widgets,
            social_links=social_links,
            emails=emails,
            response_time_ms=response_time_ms,
            content_bytes=len(content),
            audited_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _find_emails(soup: BeautifulSoup) -> list[str]:
        """Correos publicados en el sitio: enlaces mailto: y direcciones visibles en el texto."""
        found: list[str] = []
        for tag in soup.select('a[href^="mailto:" i]'):
            address = tag.get("href", "")[7:].split("?")[0].strip()
            if address:
                found.append(address)
        text = soup.get_text(" ", strip=True)
        found += re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}", text)
        unique: list[str] = []
        for address in found:
            address = address.lower().strip(".")
            # Descarta imágenes con @2x y correos de ejemplo de plantillas.
            if address.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")) or address.split("@")[-1] in {"example.com", "dominio.com", "email.com", "sentry.io"}:
                continue
            if address not in unique:
                unique.append(address)
        return unique[:5]

    @staticmethod
    def _find_chatbots(soup: BeautifulSoup) -> list[str]:
        providers = ("intercom", "crisp", "drift", "tawk", "zendesk", "hubspot", "tidio", "chatra")
        found: set[str] = set()
        for tag in soup.find_all(["script", "iframe", "div"]):
            source = str(tag).lower()
            found.update(provider for provider in providers if provider in source)
        return sorted(found)
