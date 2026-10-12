"""
Modelos SQLAlchemy: Lead + LeadNote + LeadTask (ficha de CRM).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.sql import expression
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.infrastructure.database.base import Base


class LeadModel(Base):
    __tablename__ = "leads"
    __table_args__ = (
        Index("ix_leads_workspace_id", "workspace_id"),
        Index("ix_leads_workspace_status", "workspace_id", "status"),
        # Deduplicación: mismo origen (place_id) no puede repetirse dentro del workspace
        UniqueConstraint("workspace_id", "raw_source_id", name="uq_leads_workspace_raw_source"),
        Index(
            "uq_leads_workspace_external_id",
            "workspace_id",
            "external_id",
            unique=True,
            postgresql_where=expression.column("external_id").is_not(None),
        ),
        Index(
            "uq_leads_workspace_normalized_phone",
            "workspace_id",
            "normalized_phone",
            unique=True,
            postgresql_where=expression.column("normalized_phone").is_not(None),
        ),
        Index(
            "uq_leads_workspace_root_domain",
            "workspace_id",
            "root_domain",
            unique=True,
            postgresql_where=expression.column("root_domain").is_not(None),
        ),
        Index(
            "uq_leads_workspace_name_address",
            "workspace_id",
            "normalized_name_address",
            unique=True,
            postgresql_where=expression.column("normalized_name_address").is_not(None),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    raw_source_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    do_not_contact: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    normalized_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    root_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    normalized_name_address: Mapped[str | None] = mapped_column(String(600), nullable=True)
    dedupe_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    instagram: Mapped[str | None] = mapped_column(String(255), nullable=True)
    facebook: Mapped[str | None] = mapped_column(String(255), nullable=True)
    listing_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    reviews_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photos_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    lead_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lead_score_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    score_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    score_reasons: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    score_niche: Mapped[str | None] = mapped_column(String(100), nullable=True)
    score_calculated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    owner_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # CSV simple; se puede normalizar luego
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    contact_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    notes: Mapped[list["LeadNoteModel"]] = relationship(back_populates="lead", cascade="all, delete-orphan")
    tasks: Mapped[list["LeadTaskModel"]] = relationship(back_populates="lead", cascade="all, delete-orphan")


class LeadSearchHistoryModel(Base):
    __tablename__ = "lead_search_history"
    __table_args__ = (
        Index("ix_lead_search_history_workspace_updated", "workspace_id", "updated_at"),
        Index("ix_lead_search_history_workspace_query", "workspace_id", "query"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    query: Mapped[str] = mapped_column(String(255), nullable=False)
    filters: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WebAuditModel(Base):
    __tablename__ = "lead_web_audits"

    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True
    )
    website_reachable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    https_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    has_title: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    has_meta_description: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    mobile_friendly: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    load_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    audited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LeadScoringConfigModel(Base):
    __tablename__ = "lead_scoring_configs"

    niche: Mapped[str] = mapped_column(String(100), primary_key=True)
    weights: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LeadNoteModel(Base):
    __tablename__ = "lead_notes"
    __table_args__ = (Index("ix_lead_notes_lead_id", "lead_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id: Mapped[str] = mapped_column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    author_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lead: Mapped["LeadModel"] = relationship(back_populates="notes")


class LeadTaskModel(Base):
    __tablename__ = "lead_tasks"
    __table_args__ = (Index("ix_lead_tasks_lead_id", "lead_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id: Mapped[str] = mapped_column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_to_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    lead: Mapped["LeadModel"] = relationship(back_populates="tasks")


class LeadFollowUpModel(Base):
    __tablename__ = "lead_follow_ups"
    __table_args__ = (
        Index("ix_lead_follow_ups_workspace_status_date", "workspace_id", "status", "next_follow_up_at"),
        Index(
            "ix_lead_follow_ups_pending_date",
            "next_follow_up_at",
            postgresql_where=text("status IN ('pending', 'due')"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    next_follow_up_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
