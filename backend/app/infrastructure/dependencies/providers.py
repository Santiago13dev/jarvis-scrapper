"""
Composición de dependencias (Dependency Injection) para FastAPI.

Este es el ÚNICO lugar del proyecto donde se decide qué implementación concreta
satisface cada Port. Los casos de uso y routers sólo dependen de las funciones de aquí
(vía `Depends(...)`), nunca importan un adapter directamente.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports import (
    AIProvider,
    CacheProvider,
    CampaignRepository,
    ConversationRepository,
    EventBus,
    FileStorageProvider,
    LeadRepository,
    MessagingProvider,
    OrganizationRepository,
    QueueProvider,
    ScraperProvider,
    StatisticsRepository,
    TemplateRepository,
    UserRepository,
)
from app.infrastructure.adapters.ai.openai_adapter import OpenAIAdapter
from app.infrastructure.adapters.cache.redis_cache_adapter import RedisCacheAdapter
from app.infrastructure.adapters.event_bus.in_memory_event_bus import InMemoryEventBus
from app.infrastructure.adapters.file_storage.local_file_storage_adapter import LocalFileStorageAdapter
from app.infrastructure.adapters.messaging.openwa_adapter import OpenWAAdapter
from app.infrastructure.adapters.queue.arq_queue_adapter import ArqQueueAdapter
from app.infrastructure.adapters.scraper.google_maps_adapter import GoogleMapsScraperAdapter
from app.infrastructure.database.session import get_db_session
from app.infrastructure.repositories import (
    PostgresCampaignRepository,
    PostgresConversationRepository,
    PostgresLeadRepository,
    PostgresOrganizationRepository,
    PostgresStatisticsRepository,
    PostgresTemplateRepository,
    PostgresUserRepository,
)

DbSession = Annotated[AsyncSession, Depends(get_db_session)]

# --- Singletons a nivel de proceso (sin estado por-request) ---
_event_bus_singleton = InMemoryEventBus()


# --- Repositorios (dependen de la sesión de DB, scoped por request) ---
def get_lead_repository(session: DbSession) -> LeadRepository:
    return PostgresLeadRepository(session)


def get_campaign_repository(session: DbSession) -> CampaignRepository:
    return PostgresCampaignRepository(session)


def get_conversation_repository(session: DbSession) -> ConversationRepository:
    return PostgresConversationRepository(session)


def get_template_repository(session: DbSession) -> TemplateRepository:
    return PostgresTemplateRepository(session)


def get_user_repository(session: DbSession) -> UserRepository:
    return PostgresUserRepository(session)


def get_organization_repository(session: DbSession) -> OrganizationRepository:
    return PostgresOrganizationRepository(session)


def get_statistics_repository(session: DbSession) -> StatisticsRepository:
    return PostgresStatisticsRepository(session)


# --- Providers de infraestructura externa (sin estado por-request) ---
def get_ai_provider() -> AIProvider:
    return OpenAIAdapter()


def get_messaging_provider() -> MessagingProvider:
    return OpenWAAdapter()


def get_scraper_provider() -> ScraperProvider:
    return GoogleMapsScraperAdapter()


def get_file_storage_provider() -> FileStorageProvider:
    return LocalFileStorageAdapter()


def get_queue_provider() -> QueueProvider:
    return ArqQueueAdapter()


def get_cache_provider() -> CacheProvider:
    return RedisCacheAdapter()


def get_event_bus() -> EventBus:
    return _event_bus_singleton


async def default_knowledge_base_lookup(workspace_id: str) -> str:
    """
    Implementación por defecto de KnowledgeBaseLookup (usada por
    ProcessIncomingWhatsAppMessageUseCase). Lee la base de conocimiento configurable del
    workspace desde caché (clave `kb:{workspace_id}`). En el futuro esto debería venir de
    una tabla `workspace_settings` administrable desde el frontend; por ahora, si no hay
    nada configurado, devuelve una cadena vacía y el agente IA transferirá a un humano
    (nunca inventa información, tal como exige el dominio).
    """
    cache = get_cache_provider()
    value = await cache.get(f"kb:{workspace_id}")
    return value or ""
