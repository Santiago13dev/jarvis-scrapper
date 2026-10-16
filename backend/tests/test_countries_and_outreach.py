from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.application.services.lead_scoring_service import LeadScoringService
from app.application.services.outreach_message_service import OutreachMessageService
from app.application.services.outreach_service import OutreachService
from app.domain.countries import get_country
from app.domain.entities.lead import Lead, LeadStatus
from app.domain.value_objects.lead_score import LeadScore


def test_whatsapp_numbers_are_international_and_mobile_only() -> None:
    colombia, spain, usa = get_country("CO"), get_country("ES"), get_country("US")

    assert colombia.whatsapp_number("324 6796126") == "573246796126"
    assert colombia.whatsapp_number("+57 324 679 6126") == "573246796126"
    assert colombia.whatsapp_number("(601) 6231878") is None  # fijo de Bogotá
    assert spain.whatsapp_number("612 34 56 78") == "34612345678"
    assert spain.whatsapp_number("912 34 56 78") is None  # fijo de Madrid
    assert usa.whatsapp_number("(305) 555-0123") == "13055550123"
    assert usa.whatsapp_number("+1 305-555-0123") == "13055550123"
    assert get_country("XX").code == "CO"


def _lead(**overrides) -> Lead:
    values = dict(
        workspace_id="w",
        raw_source_id=None,
        name="Clínica Dental Sonrisa - Sede Norte",
        category="Clínica dental",
        phone="300",
        whatsapp="573001234567",
        rating=4.8,
        reviews_count=250,
        country="CO",
        score_niche="landing",
    )
    values.update(overrides)
    return Lead(**values)


def test_first_touch_message_is_personalized_per_country() -> None:
    service = OutreachMessageService()

    colombia = service.first_touch(_lead(instagram="https://instagram.com/sonrisa"))
    assert colombia.startswith("Hola, Clínica Dental Sonrisa 👋")
    assert "4,8⭐ con 250 reseñas" in colombia
    assert "no tienen página web propia, solo Instagram" in colombia
    assert "responda NO" in colombia

    spain = service.first_touch(_lead(country="ES", score_niche="whatsapp_ai"))
    assert "tenéis 4,8⭐" in spain and "asistente con IA para WhatsApp" in spain

    usa = service.first_touch(_lead(country="US", name="Bright Smiles", category="Dentist", score_niche="seo", website="https://x.com"))
    assert usa.startswith("Hi Bright Smiles") and "4.8⭐" in usa and "reply STOP" in usa


def test_follow_up_and_opt_out_detection() -> None:
    service = OutreachMessageService()
    assert "una landing page" in service.follow_up(_lead())
    assert "an online store" in service.follow_up(_lead(country="US", score_niche="ecommerce"))
    assert service.is_opt_out(" No. ") and service.is_opt_out("STOP")
    assert not service.is_opt_out("No sé, ¿cuánto cuesta?")


def test_prices_only_shown_for_colombia() -> None:
    colombia = LeadScoringService().calculate(_lead(score_niche=None))
    spain = LeadScoringService().calculate(_lead(country="ES", score_niche=None))

    assert "COP" in colombia.pitch
    assert spain.pitch is not None and "COP" not in spain.pitch


def test_contactable_requires_whatsapp_score_and_new_status() -> None:
    lead = _lead()
    lead.score = LeadScore(value=80, summary="")
    assert OutreachService.is_contactable(lead, 70)
    assert not OutreachService.is_contactable(lead, 90)
    lead.status = LeadStatus.CONTACTED
    assert not OutreachService.is_contactable(lead, 70)


def test_messages_are_scheduled_within_local_business_hours() -> None:
    madrid = ZoneInfo("Europe/Madrid")
    late_night = datetime(2026, 10, 14, 23, 30, tzinfo=madrid).astimezone(timezone.utc)  # miércoles
    saturday_noon = datetime(2026, 10, 17, 12, 0, tzinfo=madrid).astimezone(timezone.utc)
    sunday = datetime(2026, 10, 18, 12, 0, tzinfo=madrid).astimezone(timezone.utc)

    next_morning = OutreachService.within_business_hours(late_night, "Europe/Madrid").astimezone(madrid)
    assert next_morning.date().day == 15 and 9 <= next_morning.hour < 10

    assert OutreachService.within_business_hours(saturday_noon, "Europe/Madrid") == saturday_noon

    monday = OutreachService.within_business_hours(sunday, "Europe/Madrid").astimezone(madrid)
    assert monday.weekday() == 0 and monday.hour == 9
