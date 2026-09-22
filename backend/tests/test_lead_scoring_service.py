from app.application.dto.lead_scoring_dto import LeadScoringWeights
from app.application.services.lead_scoring_service import LeadScoringService
from app.domain.entities.lead import Lead
from app.domain.entities.web_audit import WebAudit


def test_scoring_is_deterministic_and_returns_high_level():
    lead = Lead(
        workspace_id="workspace-1",
        raw_source_id=None,
        name="Acme",
        website="https://acme.test",
        phone="555",
        rating=4.8,
        reviews_count=120,
    )
    audit = WebAudit(
        lead_id=lead.id,
        website_reachable=True,
        https_enabled=True,
        has_title=True,
        has_meta_description=True,
        mobile_friendly=True,
        load_time_ms=1200,
    )

    first = LeadScoringService().calculate(lead, audit, niche="restaurant")
    second = LeadScoringService().calculate(lead, audit, niche="restaurant")

    assert first.score == 100
    assert first.level == "high"
    assert first.reasons == second.reasons
    assert sum(reason.points for reason in first.reasons) == 100


def test_niche_weights_change_relative_score():
    lead = Lead(workspace_id="workspace-1", raw_source_id=None, name="Acme", website="https://acme.test")
    weights = LeadScoringWeights(
        rating=0,
        reviews=0,
        contact=0,
        website=100,
        https=0,
        reachable=0,
        mobile=0,
        seo=0,
        performance=0,
    )

    result = LeadScoringService().calculate(lead, weights=weights, niche="digital")

    assert result.score == 100
    assert result.level == "high"
    assert result.niche == "digital"
