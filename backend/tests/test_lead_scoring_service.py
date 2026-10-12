from app.application.dto.lead_scoring_dto import LeadScoringWeights
from app.application.services.lead_scoring_service import LeadScoringService
from app.domain.entities.lead import Lead
from app.domain.entities.web_audit import WebAudit


def make_lead(**kwargs) -> Lead:
    return Lead(workspace_id="workspace-1", raw_source_id=None, name="Acme", **kwargs)


def test_solid_business_without_website_is_top_opportunity():
    lead = make_lead(whatsapp="573001234567", phone="300 1234567", rating=4.8, reviews_count=120, instagram="https://instagram.com/acme")

    first = LeadScoringService().calculate(lead, niche="restaurant")
    second = LeadScoringService().calculate(lead, niche="restaurant")

    assert first.score == 100
    assert first.level == "high"
    assert first.reasons == second.reasons
    assert any("No tiene página web propia (solo redes sociales)" in r.description for r in first.reasons)


def test_polished_website_lowers_the_opportunity():
    lead = make_lead(website="https://acme.test", whatsapp="573001234567", rating=4.8, reviews_count=120)
    audit = WebAudit(
        lead_id=lead.id,
        website_reachable=True,
        https_enabled=True,
        has_title=True,
        has_meta_description=True,
        mobile_friendly=True,
        load_time_ms=1200,
    )

    result = LeadScoringService().calculate(lead, audit)

    assert result.score == 50  # solo suma «vale la pena»: no hay nada digital que venderle
    assert result.level == "medium"


def test_website_problems_found_by_audit_add_opportunity():
    lead = make_lead(website="https://acme.test", phone="601 3145654", rating=4.2, reviews_count=40)
    audit = WebAudit(lead_id=lead.id, website_reachable=True, https_enabled=False, mobile_friendly=False, load_time_ms=5200)

    result = LeadScoringService().calculate(lead, audit)
    by_text = {r.description: r.points for r in result.reasons}

    assert by_text["Su sitio no usa HTTPS (aparece como «no seguro»)"] == 5
    assert by_text["Su sitio no está adaptado a celulares"] == 5
    assert by_text["Su sitio tarda más de 3 segundos en cargar"] == 5
    assert result.score == 9 + 9 + 12 + 15


def test_unaudited_website_does_not_invent_problems():
    lead = make_lead(website="https://acme.test")

    result = LeadScoringService().calculate(lead)

    assert result.score == 0
    assert any(r.description == "Auditoría del sitio pendiente" for r in result.reasons)


def test_free_website_counts_as_half_opportunity():
    lead = make_lead(website="https://acme.wixsite.com/inicio")

    result = LeadScoringService().calculate(lead)

    assert result.score == 12  # 25 × 0,5 = 12,5 → Python redondea al par más cercano


def test_niche_weights_change_relative_score():
    lead = make_lead()
    weights = LeadScoringWeights(rating=0, reviews=0, contact=0, website=100, https=0, reachable=0, mobile=0, seo=0, performance=0)

    result = LeadScoringService().calculate(lead, weights=weights, niche="digital")

    assert result.score == 100
    assert result.level == "high"
    assert result.niche == "digital"
