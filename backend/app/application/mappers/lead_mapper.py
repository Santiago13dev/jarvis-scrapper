"""
Mapper: Lead ↔ LeadModel (incluye notas y tareas del CRM).
"""
from __future__ import annotations

from app.domain.entities.lead import Lead, LeadNote, LeadStatus, LeadTask
from app.domain.value_objects.lead_score import LeadScore
from app.infrastructure.database.models.lead import LeadModel, LeadNoteModel, LeadTaskModel


class LeadMapper:
    @staticmethod
    def to_entity(model: LeadModel) -> Lead:
        score = (
            LeadScore(value=model.lead_score, summary=model.lead_score_summary or "")
            if model.lead_score is not None
            else None
        )
        return Lead(
            id=model.id,
            workspace_id=model.workspace_id,
            raw_source_id=model.raw_source_id,
            external_id=model.external_id,
            do_not_contact=model.do_not_contact,
            name=model.name,
            address=model.address,
            phone=model.phone,
            website=model.website,
            email=model.email,
            whatsapp=model.whatsapp,
            instagram=model.instagram,
            facebook=model.facebook,
            category=model.category,
            rating=model.rating,
            reviews_count=model.reviews_count,
            photos_count=model.photos_count,
            latitude=model.latitude,
            longitude=model.longitude,
            normalized_phone=model.normalized_phone,
            root_domain=model.root_domain,
            normalized_name_address=model.normalized_name_address,
            dedupe_fingerprint=model.dedupe_fingerprint,
            score=score,
            score_level=model.score_level,
            score_reasons=model.score_reasons or [],
            score_niche=model.score_niche,
            score_calculated_at=model.score_calculated_at,
            status=LeadStatus(model.status),
            owner_user_id=model.owner_user_id,
            tags=model.tags.split(",") if model.tags else [],
            notes=[
                LeadNote(
                    id=n.id, author_user_id=n.author_user_id, content=n.content, created_at=n.created_at
                )
                for n in model.notes
            ],
            tasks=[
                LeadTask(
                    id=t.id, title=t.title, due_date=t.due_date,
                    assigned_to_user_id=t.assigned_to_user_id, is_done=t.is_done,
                )
                for t in model.tasks
            ],
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def to_model(entity: Lead) -> LeadModel:
        return LeadModel(
            id=entity.id,
            workspace_id=entity.workspace_id,
            raw_source_id=entity.raw_source_id,
            external_id=entity.external_id,
            do_not_contact=entity.do_not_contact,
            name=entity.name,
            address=entity.address,
            phone=entity.phone,
            website=entity.website,
            email=entity.email,
            whatsapp=entity.whatsapp,
            instagram=entity.instagram,
            facebook=entity.facebook,
            category=entity.category,
            rating=entity.rating,
            reviews_count=entity.reviews_count,
            photos_count=entity.photos_count,
            latitude=entity.latitude,
            longitude=entity.longitude,
            normalized_phone=entity.normalized_phone,
            root_domain=entity.root_domain,
            normalized_name_address=entity.normalized_name_address,
            dedupe_fingerprint=entity.dedupe_fingerprint,
            lead_score=entity.score.value if entity.score else None,
            lead_score_summary=entity.score.summary if entity.score else None,
            score_level=entity.score_level,
            score_reasons=entity.score_reasons or None,
            score_niche=entity.score_niche,
            score_calculated_at=entity.score_calculated_at,
            status=entity.status.value,
            owner_user_id=entity.owner_user_id,
            tags=",".join(entity.tags) if entity.tags else None,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )
