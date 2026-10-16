"""
Modelos SQLAlchemy de automatización comercial:
- AutopilotRuleModel: búsquedas programadas (rubros × ciudades × país) que corren solas.
- OutreachDraftModel: mensajes personalizados que esperan aprobación antes de enviarse.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class AutopilotRuleModel(Base):
    __tablename__ = "autopilot_rules"
    __table_args__ = (Index("ix_autopilot_rules_active_next_run", "is_active", "next_run_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False, default="CO")
    keywords: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    locations: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    depth: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    frequency_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    min_score: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_running: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    total_leads_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OutreachDraftModel(Base):
    __tablename__ = "outreach_drafts"
    __table_args__ = (
        Index("ix_outreach_drafts_workspace_status", "workspace_id", "status"),
        Index("ix_outreach_drafts_lead", "lead_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    lead_id: Mapped[str] = mapped_column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="first_touch")  # first_touch | follow_up
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="whatsapp")
    to_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # pending_approval → approved → sent | failed ; o rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending_approval")
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
