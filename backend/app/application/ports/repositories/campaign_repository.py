"""
Port: CampaignRepository
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Sequence

if TYPE_CHECKING:
    from app.domain.entities.campaign import Campaign


class CampaignRepository(ABC):

    @abstractmethod
    async def get_by_id(self, workspace_id: str, campaign_id: str) -> "Campaign | None":
        raise NotImplementedError

    @abstractmethod
    async def list_by_workspace(
        self, workspace_id: str, status: str | None = None
    ) -> Sequence["Campaign"]:
        raise NotImplementedError

    @abstractmethod
    async def create(self, workspace_id: str, campaign: "Campaign") -> "Campaign":
        raise NotImplementedError

    @abstractmethod
    async def update(self, workspace_id: str, campaign: "Campaign") -> "Campaign":
        raise NotImplementedError

    @abstractmethod
    async def update_status(
        self, workspace_id: str, campaign_id: str, status: str
    ) -> None:
        """pause / resume / finish."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, workspace_id: str, campaign_id: str) -> None:
        raise NotImplementedError
