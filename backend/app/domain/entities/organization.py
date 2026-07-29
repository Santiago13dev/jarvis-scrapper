"""
Entidades: Organization y Workspace.

Organization = la agencia (cliente de ProspectAI).
Workspace = una cuenta/cliente de esa agencia (ej. "Coca-Cola", "Adidas").
Todas las entidades de negocio (Lead, Campaign, Conversation...) pertenecen a un Workspace.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Organization:
    name: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def deactivate(self) -> None:
        self.is_active = False


@dataclass
class Workspace:
    organization_id: str
    name: str
    business_category: str | None = None  # restaurante, hotel, abogado... (para páginas demo)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def deactivate(self) -> None:
        self.is_active = False
