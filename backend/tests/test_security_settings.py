import asyncio

import pytest
from fastapi import HTTPException

from app.infrastructure.api.v1.whatsapp import router as whatsapp_router
from app.infrastructure.config.config import Settings


def make_settings(**overrides) -> Settings:
    base = {
        "database_url": "postgresql+asyncpg://u:p@db/x",
        "redis_url": "redis://r:6379/0",
        "jwt_secret_key": "k" * 40,
    }
    base.update(overrides)
    return Settings(_env_file=None, **base)


def test_production_rejects_default_jwt_secret():
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        make_settings(environment="production", jwt_secret_key="change-me-in-production")


def test_production_with_strong_secret_is_accepted():
    settings = make_settings(environment="production")
    assert settings.is_production


def run_webhook_check(monkeypatch, settings: Settings, header: str | None):
    monkeypatch.setattr("app.infrastructure.config.config.get_settings", lambda: settings)
    return asyncio.run(whatsapp_router.verify_openwa_webhook(header))


def test_webhook_requires_matching_secret(monkeypatch):
    settings = make_settings(openwa_webhook_secret="s3cret")
    with pytest.raises(HTTPException) as error:
        run_webhook_check(monkeypatch, settings, "otro")
    assert error.value.status_code == 401
    assert run_webhook_check(monkeypatch, settings, "s3cret") is None


def test_webhook_without_secret_is_closed_in_production(monkeypatch):
    settings = make_settings(environment="production", whatsapp_provider="assisted")
    with pytest.raises(HTTPException) as error:
        run_webhook_check(monkeypatch, settings, None)
    assert error.value.status_code == 403
