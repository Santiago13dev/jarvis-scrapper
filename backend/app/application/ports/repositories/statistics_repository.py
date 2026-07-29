"""
Port: StatisticsRepository

Lecturas agregadas para el dashboard. Separado de los repositorios transaccionales
porque suele resolverse con queries de agregación (o incluso un read-model /
materialized view a futuro) en vez de operaciones CRUD estándar.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class DashboardStatistics:
    total_leads: int
    total_campaigns_active: int
    total_conversations_open: int
    total_conversations_transferred_to_human: int
    average_lead_score: float
    messages_sent_last_30_days: int
    conversion_rate: float  # leads con respuesta positiva / leads contactados


class StatisticsRepository(ABC):

    @abstractmethod
    async def get_dashboard_summary(self, workspace_id: str) -> DashboardStatistics:
        raise NotImplementedError

    @abstractmethod
    async def get_leads_scraped_per_day(
        self, workspace_id: str, start: date, end: date
    ) -> dict[date, int]:
        raise NotImplementedError

    @abstractmethod
    async def get_campaign_performance(self, workspace_id: str, campaign_id: str) -> dict:
        raise NotImplementedError
