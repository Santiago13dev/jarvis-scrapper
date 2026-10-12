from app.domain.entities.lead import Lead
from app.domain.services.lead_enrichment import (
    WebsiteKind,
    apply_enrichment,
    classify_website,
    normalize_phone,
)


def make_lead(**kwargs) -> Lead:
    return Lead(workspace_id="ws", name="Negocio", raw_source_id=None, **kwargs)


def test_colombian_mobile_becomes_whatsapp():
    assert normalize_phone("321 4915662") == ("573214915662", True)
    assert normalize_phone("+57 316 469 7940") == ("573164697940", True)


def test_landlines_are_not_whatsapp():
    assert normalize_phone("(601) 3145654") == ("576013145654", False)
    assert normalize_phone("3145654") == ("576013145654", False)  # fijo antiguo de Bogotá


def test_invalid_phone_is_ignored():
    assert normalize_phone("15431239") == (None, False)
    assert normalize_phone(None) == (None, False)


def test_classify_social_directory_and_own_sites():
    assert classify_website("https://instagram.com/delcesto?utm_medium=copy_link") == (WebsiteKind.SOCIAL, "instagram")
    assert classify_website("https://es.restaurantguru.com/Panaderia-MORETTI-Bogota")[0] is WebsiteKind.DIRECTORY
    assert classify_website("www.panaderiamoretti.com") == (WebsiteKind.OWN, None)
    assert classify_website("https://mipanaderia.wixsite.com/inicio") == (WebsiteKind.OWN, "free")
    assert classify_website("") == (WebsiteKind.NONE, None)


def test_instagram_as_website_means_no_own_website():
    lead = make_lead(phone="321 4915662", website="https://instagram.com/delcesto_panartesano?utm_medium=copy_link")
    result = apply_enrichment(lead)

    assert lead.website is None
    assert lead.instagram == "https://instagram.com/delcesto_panartesano"
    assert lead.whatsapp == "573214915662"
    assert result.website_kind is WebsiteKind.SOCIAL
    assert {"sin-web", "solo-redes", "whatsapp"} <= set(lead.tags)


def test_directory_listing_is_kept_separately():
    lead = make_lead(website="https://es.restaurantguru.com/Panaderia-MORETTI-Bogota")
    apply_enrichment(lead)

    assert lead.website is None
    assert lead.listing_url == "https://es.restaurantguru.com/Panaderia-MORETTI-Bogota"
    assert "sin-web" in lead.tags


def test_enrichment_is_idempotent():
    lead = make_lead(phone="3001234567", website="negocio.com.co")
    apply_enrichment(lead)
    first = (lead.website, lead.whatsapp, sorted(lead.tags))
    apply_enrichment(lead)

    assert (lead.website, lead.whatsapp, sorted(lead.tags)) == first
    assert lead.website == "https://negocio.com.co"
    assert "sin-web" not in lead.tags
