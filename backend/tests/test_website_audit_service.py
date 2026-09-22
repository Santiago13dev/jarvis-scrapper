import httpx
import pytest

from app.application.services.website_audit_service import WebsiteAuditError, WebsiteAuditService


@pytest.mark.asyncio
async def test_audit_extracts_business_signals_without_browser(monkeypatch):
    html = b'''
    <html><head><title>Acme</title>
    <meta name="viewport" content="width=device-width">
    <meta name="description" content="Servicios Acme"></head>
    <body><a href="tel:+34123">phone</a><a href="https://wa.me/34123">wa</a>
    <a href="/agenda">agenda</a><a href="https://instagram.com/acme">social</a>
    <form></form><script src="https://widget.intercom.io/widget.js"></script></body></html>
    '''

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=html, request=request)

    async def skip_host_validation(url: str) -> None:
        return None

    monkeypatch.setattr(WebsiteAuditService, "_validate_host", skip_host_validation)
    service = WebsiteAuditService(httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    result = await service.audit("https://example.com")

    assert result.status_code == 200
    assert result.https is True
    assert result.meta_viewport is True
    assert result.title == "Acme"
    assert result.meta_description == "Servicios Acme"
    assert result.phone_links == ["tel:+34123"]
    assert result.whatsapp_links == ["https://wa.me/34123"]
    assert result.forms == 1
    assert result.booking_links == ["https://example.com/agenda"]
    assert result.chatbot_widgets == ["intercom"]
    assert result.social_links == ["https://instagram.com/acme"]


@pytest.mark.asyncio
async def test_audit_rejects_private_hosts_before_request():
    service = WebsiteAuditService()

    with pytest.raises(WebsiteAuditError, match="privada o local"):
        await service.audit("http://127.0.0.1:8080")


@pytest.mark.asyncio
async def test_audit_rejects_non_http_schemes():
    service = WebsiteAuditService()

    with pytest.raises(WebsiteAuditError, match="HTTP y HTTPS"):
        await service.audit("file:///etc/passwd")
