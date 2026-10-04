from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from collections.abc import Sequence
from urllib.parse import urlsplit

from app.domain.entities.lead import Lead


@dataclass(frozen=True)
class LeadIdentity:
    external_id: str | None
    normalized_phone: str | None
    root_domain: str | None
    normalized_name_address: str | None
    fingerprint: str
    candidate_fingerprints: tuple[str, ...]


@dataclass(frozen=True)
class MergeResult:
    lead: Lead
    changed_fields: tuple[str, ...]


class LeadDeduplicationService:
    def identify(self, lead: Lead, default_country_code: str | None = None) -> LeadIdentity:
        external_id = self.normalize_external_id(lead.raw_source_id)
        normalized_phone = self.normalize_phone(lead.phone or lead.whatsapp, default_country_code)
        root_domain = self.normalize_domain(lead.website)
        normalized_name_address = self.normalize_name_address(lead.name, lead.address)

        components = (
            ("external_id", external_id),
            ("phone", normalized_phone),
            ("domain", root_domain),
            ("name_address", normalized_name_address),
        )
        available = [(kind, value) for kind, value in components if value]
        fingerprint = self._fingerprint(*available[:1]) if available else self._fingerprint(("lead", lead.id))
        candidate_fingerprints = tuple(
            self._fingerprint((kind, value)) for kind, value in available
        )
        return LeadIdentity(
            external_id=external_id,
            normalized_phone=normalized_phone,
            root_domain=root_domain,
            normalized_name_address=normalized_name_address,
            fingerprint=fingerprint,
            candidate_fingerprints=candidate_fingerprints,
        )

    def merge(self, primary: Lead, duplicate: Lead) -> MergeResult:
        if primary.workspace_id != duplicate.workspace_id:
            raise ValueError("No se pueden combinar leads de workspaces distintos")

        changed: list[str] = []
        scalar_fields = (
            "raw_source_id", "address", "phone", "website", "email", "whatsapp",
            "instagram", "facebook", "category", "rating", "reviews_count", "photos_count",
            "latitude", "longitude", "score", "score_level", "score_reasons", "score_niche",
            "score_calculated_at", "owner_user_id", "do_not_contact",
        )
        for field_name in scalar_fields:
            current = getattr(primary, field_name)
            incoming = getattr(duplicate, field_name)
            if self._is_empty(current) and not self._is_empty(incoming):
                setattr(primary, field_name, incoming)
                changed.append(field_name)

        for tag in duplicate.tags:
            if tag not in primary.tags:
                primary.tags.append(tag)
                changed.append("tags")
        existing_note_ids = {note.id for note in primary.notes}
        for note in duplicate.notes:
            if note.id not in existing_note_ids:
                primary.notes.append(note)
                changed.append("notes")
        existing_task_ids = {task.id for task in primary.tasks}
        for task in duplicate.tasks:
            if task.id not in existing_task_ids:
                primary.tasks.append(task)
                changed.append("tasks")

        primary.updated_at = duplicate.updated_at if duplicate.updated_at > primary.updated_at else primary.updated_at
        return MergeResult(lead=primary, changed_fields=tuple(dict.fromkeys(changed)))

    def deduplicate(self, leads: Sequence[Lead]) -> tuple[list[Lead], int]:
        unique: list[Lead] = []
        merged_count = 0
        fingerprints: dict[str, Lead] = {}
        for lead in leads:
            identity = self.identify(lead)
            match = next(
                (fingerprints[fingerprint] for fingerprint in identity.candidate_fingerprints if fingerprint in fingerprints),
                None,
            )
            if match is None:
                unique.append(lead)
                for fingerprint in identity.candidate_fingerprints:
                    fingerprints[fingerprint] = lead
                continue
            self.merge(match, lead)
            merged_count += 1
        return unique, merged_count

    @staticmethod
    def apply_identity(lead: Lead, identity: LeadIdentity) -> Lead:
        lead.external_id = identity.external_id
        lead.normalized_phone = identity.normalized_phone
        lead.root_domain = identity.root_domain
        lead.normalized_name_address = identity.normalized_name_address
        lead.dedupe_fingerprint = identity.fingerprint
        return lead

    @staticmethod
    def normalize_external_id(value: str | None) -> str | None:
        return LeadDeduplicationService._clean(value)

    @staticmethod
    def normalize_phone(value: str | None, default_country_code: str | None = None) -> str | None:
        if not value:
            return None
        compact = re.sub(r"(?:ext\.?|x)\s*\d+$", "", value, flags=re.IGNORECASE)
        digits = re.sub(r"\D", "", compact)
        if not digits:
            return None

        if compact.strip().startswith("00"):
            return "+" + digits[2:]
        if compact.strip().startswith("+"):
            return "+" + digits

        country = re.sub(r"\D", "", default_country_code or "")
        if country and digits.startswith(country):
            return "+" + digits
        return f"+{country}{digits}" if country else digits

    @staticmethod
    def normalize_domain(value: str | None) -> str | None:
        if not value:
            return None
        candidate = value if "://" in value else f"https://{value}"
        hostname = urlsplit(candidate).hostname
        if not hostname:
            return None
        hostname = hostname.rstrip(".").lower().removeprefix("www.")
        labels = hostname.split(".")
        if len(labels) >= 3 and labels[-2] in {"co", "com", "net", "org", "gov"} and len(labels[-1]) == 2:
            labels = labels[-3:]
        else:
            labels = labels[-2:]
        return ".".join(labels)

    @classmethod
    def normalize_name_address(cls, name: str | None, address: str | None) -> str | None:
        name_value = cls._normalize_text(name)
        address_value = cls._normalize_text(address)
        if not name_value:
            return None
        return f"{name_value}|{address_value}" if address_value else name_value

    @staticmethod
    def _normalize_text(value: str | None) -> str:
        if not value:
            return ""
        decomposed = unicodedata.normalize("NFKD", value)
        ascii_value = decomposed.encode("ascii", "ignore").decode("ascii")
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", ascii_value.lower())).strip()

    @staticmethod
    def _clean(value: str | None) -> str | None:
        if not value:
            return None
        cleaned = value.strip().lower()
        return cleaned or None

    @staticmethod
    def _is_empty(value: object) -> bool:
        return value is None or value == "" or value == [] or value == {}

    @staticmethod
    def _fingerprint(*components: tuple[str, str]) -> str:
        canonical = "|".join(f"{kind}:{value}" for kind, value in components)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
