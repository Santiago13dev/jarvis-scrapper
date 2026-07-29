"""
Modelos SQLAlchemy: Campaign + tabla asociativa campaign_leads (N:M con Lead).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base

campaign_leads_table = Table(
    "campaign_leads",
    Base.metadata,
    Column("campaign_id", String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True),
    Column("lead_id", String(36), ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True),
)


class CampaignModel(Base):
    __tablename__ = "campaigns"
    __table_args__ = (Index("ix_campaigns_workspace_status", "workspace_id", "status"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    message_template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("message_templates.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    leads = relationship("LeadModel", secondary=campaign_leads_table, backref="campaigns")
