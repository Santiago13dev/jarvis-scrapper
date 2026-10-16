"""
Modelo SQLAlchemy: Workspace (cliente de la agencia).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class WorkspaceModel(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        Index("ix_workspaces_organization_id", "organization_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    knowledge_base: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Ajustes comerciales editables desde Configuración
    outreach_signature: Mapped[str] = mapped_column(String(120), nullable=False, default="— Equipo Jarvis IA", server_default="— Equipo Jarvis IA")
    daily_send_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=40, server_default="40")
    follow_up_days: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    min_score: Mapped[int] = mapped_column(Integer, nullable=False, default=70, server_default="70")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organization: Mapped["OrganizationModel"] = relationship(back_populates="workspaces")
    memberships: Mapped[list["WorkspaceMembershipModel"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan"
    )
