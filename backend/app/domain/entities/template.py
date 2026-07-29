"""
Entidades: MessageTemplate (mensajes de campaña) y DemoPageTemplate (páginas demo).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class MessageTemplate:
    workspace_id: str
    name: str
    content: str  # con variables dinámicas: "Hola {{lead_name}}, ..."
    variables: list[str] = field(default_factory=list)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def render(self, values: dict[str, str]) -> str:
        rendered = self.content
        for key, value in values.items():
            rendered = rendered.replace(f"{{{{{key}}}}}", value)
        return rendered


@dataclass
class DemoPageTemplate:
    """Plantilla global (no pertenece a un workspace): restaurante, hotel, abogado, etc."""
    business_category: str
    name: str
    html_template_path: str
    preview_image_url: str | None = None
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
