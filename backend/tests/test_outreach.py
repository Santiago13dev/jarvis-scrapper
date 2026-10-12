from datetime import datetime, timedelta, timezone

from app.application.services.lead_scoring_service import LeadScoringService
from app.domain.entities.lead import Lead, LeadStatus
from app.domain.services.lead_enrichment import apply_enrichment
from app.domain.services.outreach import (
    DEFAULT_MESSAGE,
    city_from_address,
    is_contactable,
    priority,
    render_message,
    whatsapp_link,
)


def scored_lead(**kwargs) -> Lead:
    lead = Lead(workspace_id="ws", raw_source_id=None, **kwargs)
    apply_enrichment(lead)
    lead.apply_deterministic_score(LeadScoringService().calculate(lead))
    return lead


def test_city_is_taken_from_google_address():
    assert city_from_address("Ak 7 #60A - 54, Chapinero, Bogotá, Cundinamarca") == "Bogotá"
    assert city_from_address("Cl. 60 #9-88, Bogotá") == "Bogotá"
    assert city_from_address(None) == ""


def test_default_message_is_personalized():
    lead = scored_lead(
        name="Del Cesto Panadería",
        category="Panadería",
        phone="321 4915662",
        website="https://instagram.com/delcesto",
        rating=4.8,
        reviews_count=12,
    )

    message = render_message(DEFAULT_MESSAGE, lead)

    assert "Del Cesto Panadería" in message
    assert "4,8 ⭐ con 12 reseñas" in message
    assert "todavía no tienen página web propia" in message
    assert "{{" not in message


def test_legacy_lead_name_variable_still_works():
    lead = scored_lead(name="Acme")
    assert render_message("Hola {{lead_name}} / {{ negocio }}", lead) == "Hola Acme / Acme"


def test_whatsapp_link_has_number_and_encoded_text():
    lead = scored_lead(name="Acme", phone="300 1234567")
    link = whatsapp_link(lead, "Hola Acme, ¿qué tal?")
    assert link == "https://wa.me/573001234567?text=Hola%20Acme%2C%20%C2%BFqu%C3%A9%20tal%3F"


def test_landline_has_no_whatsapp_link():
    lead = scored_lead(name="Acme", phone="(601) 3145654")
    assert whatsapp_link(lead, "Hola") is None
    assert not is_contactable(lead)


def test_recently_contacted_leads_wait_their_turn():
    fresh = scored_lead(name="A", phone="3001234567", rating=4.8, reviews_count=200)
    contacted = scored_lead(name="B", phone="3001234568", rating=4.8, reviews_count=200)
    contacted.register_contact(datetime.now(timezone.utc) - timedelta(days=2))

    assert contacted.status is LeadStatus.CONTACTED
    assert priority(fresh) > priority(contacted)


def test_do_not_contact_is_respected():
    lead = scored_lead(name="Acme", phone="3001234567")
    lead.do_not_contact = True
    assert not is_contactable(lead)
