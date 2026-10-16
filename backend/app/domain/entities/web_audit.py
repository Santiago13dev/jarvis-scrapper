from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class WebAudit:
    lead_id: str
    website_reachable: bool | None = None
    https_enabled: bool | None = None
    has_title: bool | None = None
    has_meta_description: bool | None = None
    mobile_friendly: bool | None = None
    load_time_ms: int | None = None
    has_chatbot: bool | None = None
    has_whatsapp_link: bool | None = None
    has_contact_form: bool | None = None
    audited_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
