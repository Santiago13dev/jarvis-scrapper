from __future__ import annotations

import csv
import io

from app.infrastructure.adapters.scraper.google_maps_adapter import GoogleMapsScraperAdapter


def _csv(rows: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=sorted({key for row in rows for key in row}))
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def test_parse_csv_extracts_contact_data_and_flags_closed_businesses() -> None:
    text = _csv([
        {
            "title": "Café Central",
            "website": "https://www.instagram.com/cafecentral",
            "emails": "info@cafecentral.co, logo@2x.png, INFO@cafecentral.co",
            "owner": '{"id": "1", "name": "María Gómez", "link": ""}',
            "status": "Cerrado permanentemente",
            "review_rating": "4.5",
            "review_count": "210",
            "place_id": "abc",
        },
        {"title": "Ferretería Sol", "website": "https://ferreteriasol.com", "status": "Abierto", "cid": "123"},
        {"title": "Pizza Roma", "website": "https://wa.me/573001234567", "owner": "not-json"},
    ])

    cafe, ferreteria, pizza = GoogleMapsScraperAdapter._parse_csv(text)

    assert cafe.website is None
    assert cafe.instagram == "https://www.instagram.com/cafecentral"
    assert cafe.emails == ("info@cafecentral.co",)
    assert cafe.owner_name == "María Gómez"
    assert cafe.permanently_closed is True
    assert cafe.reviews_count == 210

    assert ferreteria.website == "https://ferreteriasol.com"
    assert ferreteria.permanently_closed is False
    assert ferreteria.raw_source_id == "123"

    assert pizza.website is None
    assert pizza.owner_name is None


def test_classify_website_detects_facebook_subdomains() -> None:
    assert GoogleMapsScraperAdapter._classify_website("https://m.facebook.com/negocio") == (
        None,
        None,
        "https://m.facebook.com/negocio",
    )
    assert GoogleMapsScraperAdapter._classify_website("notfacebook.com") == ("notfacebook.com", None, None)
