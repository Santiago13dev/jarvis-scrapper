from app.application.dto.lead_scoring_dto import LeadScoringWeights
from app.application.services.lead_scoring_service import LeadScoringService
from app.domain.entities.lead import Lead
from app.domain.entities.web_audit import WebAudit


def test_scoring_is_deterministic():
    lead = Lead(
        workspace_id="workspace-1",
        raw_source_id=None,
        name="Acme",
        website="https://acme.test",
        phone="555",
        rating=4.8,
        reviews_count=120,
    )
    audit = WebAudit(lead_id=lead.id, website_reachable=True, https_enabled=False, mobile_friendly=True)

    first = LeadScoringService().calculate(lead, audit)
    second = LeadScoringService().calculate(lead, audit)

    assert first.model_dump(exclude={"calculated_at"}) == second.model_dump(exclude={"calculated_at"})


def test_established_business_without_website_is_top_web_opportunity():
    lead = Lead(
        workspace_id="workspace-1",
        raw_source_id=None,
        name="Restaurante La Espiga",
        category="Restaurante",
        phone="3001234567",
        instagram="https://instagram.com/laespiga",
        rating=4.7,
        reviews_count=350,
    )

    result = LeadScoringService().calculate(lead)

    assert result.niche == "web"
    assert result.recommended_service == "Página Web Corporativa"
    assert result.level == "high"
    assert result.score == 90


def test_small_business_without_website_gets_landing_page():
    lead = Lead(workspace_id="w", raw_source_id=None, name="Taller Pérez", phone="300", reviews_count=12, rating=4.2)

    result = LeadScoringService().calculate(lead)

    assert result.niche == "landing"
    assert "800.000" in result.pitch


def test_retail_selling_on_social_media_is_ecommerce_opportunity():
    lead = Lead(
        workspace_id="w",
        raw_source_id=None,
        name="Boutique Luna",
        category="Tienda de ropa",
        website="https://boutiqueluna.co",
        instagram="https://instagram.com/boutiqueluna",
        phone="300",
        rating=4.6,
        reviews_count=80,
    )
    audit = WebAudit(lead_id=lead.id, website_reachable=True, https_enabled=True, mobile_friendly=True, load_time_ms=900)

    assert LeadScoringService().calculate(lead, audit).niche == "ecommerce"


def test_category_keywords_match_whole_word_starts():
    dentist = Lead(
        workspace_id="w",
        raw_source_id=None,
        name="Dra. Gutiérrez",
        category="Dentista cosmético",
        instagram="https://instagram.com/dra",
        phone="300",
        reviews_count=60,
        rating=4.9,
    )
    barbershop = Lead(workspace_id="w", raw_source_id=None, name="Barber", category="Barbershop")

    assert LeadScoringService().calculate(dentist).niche != "ecommerce"
    assert LeadScoringService().calculate(barbershop, niche="ecommerce").score == 0


def test_busy_clinic_with_good_website_is_whatsapp_ai_opportunity():
    lead = Lead(
        workspace_id="w",
        raw_source_id=None,
        name="Clínica Dental Sonrisa",
        category="Clínica dental",
        website="https://sonrisa.co",
        phone="300",
        rating=4.8,
        reviews_count=420,
    )
    audit = WebAudit(
        lead_id=lead.id,
        website_reachable=True,
        https_enabled=True,
        mobile_friendly=True,
        has_title=True,
        has_meta_description=True,
        load_time_ms=800,
        has_chatbot=False,
    )

    result = LeadScoringService().calculate(lead, audit)

    assert result.niche == "whatsapp_ai"
    assert result.score == 95


def test_explicit_service_niche_scores_only_that_service():
    lead = Lead(workspace_id="w", raw_source_id=None, name="Acme", website="https://acme.co")
    audit = WebAudit(lead_id=lead.id, website_reachable=True, has_title=True, has_meta_description=False)

    result = LeadScoringService().calculate(lead, audit, niche="seo")

    assert result.niche == "seo"
    assert result.recommended_service == "Posicionamiento SEO"
    assert result.score == 60


def test_niche_weights_change_relative_score():
    lead = Lead(workspace_id="workspace-1", raw_source_id=None, name="Acme", website="https://acme.test")
    weights = LeadScoringWeights(rating=0, reviews=0, contact=0, website=100, https=0, reachable=0, mobile=0, seo=0, performance=0)

    result = LeadScoringService().calculate(lead, weights=weights, niche="digital")

    assert result.score == 100
    assert result.level == "high"
    assert result.niche == "digital"
