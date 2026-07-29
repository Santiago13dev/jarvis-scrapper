"""
Ports de la capa de aplicación (interfaces / contratos con el mundo exterior).

Regla de dependencia: `application` y `domain` sólo conocen estas interfaces.
Las implementaciones concretas viven en `infrastructure/adapters/*` (proveedores externos)
e `infrastructure/repositories/*` (persistencia), y se inyectan mediante Dependency
Injection (ver infrastructure/dependencies/, pendiente de implementar).
"""
from .ai_provider import AIProvider, BusinessAnalysisInput, BusinessAnalysisResult, ChatContext, ChatResponse
from .messaging_provider import MessagingProvider, OutboundMessage, InboundMessage
from .scraper_provider import ScraperProvider, ScrapeQuery, ScrapedBusiness
from .file_storage_provider import FileStorageProvider, ExportFormat
from .queue_provider import QueueProvider
from .cache_provider import CacheProvider
from .event_bus import EventBus, EventHandler

from .repositories.lead_repository import LeadRepository
from .repositories.campaign_repository import CampaignRepository
from .repositories.conversation_repository import ConversationRepository
from .repositories.template_repository import TemplateRepository
from .repositories.user_repository import UserRepository, OrganizationRepository
from .repositories.statistics_repository import StatisticsRepository, DashboardStatistics

__all__ = [
    # Provider ports
    "AIProvider",
    "BusinessAnalysisInput",
    "BusinessAnalysisResult",
    "ChatContext",
    "ChatResponse",
    "MessagingProvider",
    "OutboundMessage",
    "InboundMessage",
    "ScraperProvider",
    "ScrapeQuery",
    "ScrapedBusiness",
    "FileStorageProvider",
    "ExportFormat",
    "QueueProvider",
    "CacheProvider",
    "EventBus",
    "EventHandler",
    # Repository ports
    "LeadRepository",
    "CampaignRepository",
    "ConversationRepository",
    "TemplateRepository",
    "UserRepository",
    "OrganizationRepository",
    "StatisticsRepository",
    "DashboardStatistics",
]
