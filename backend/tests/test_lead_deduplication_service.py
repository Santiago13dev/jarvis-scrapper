from app.application.services.lead_deduplication_service import LeadDeduplicationService
from app.domain.entities.lead import Lead


def test_normalizes_identity_fields_and_generates_same_candidate_fingerprint():
    service = LeadDeduplicationService()
    first = Lead(
        workspace_id="workspace-1",
        raw_source_id="PLACE-42",
        name="Café Bogotá",
        address="Calle 10 # 5-20",
        phone="+57 (300) 123-4567",
        website="https://www.cafe-bogota.com/menu",
    )
    second = Lead(
        workspace_id="workspace-1",
        raw_source_id="place-42",
        name="Cafe Bogota",
        address="Calle 10 5 20",
        phone="+57 3001234567",
        website="http://cafe-bogota.com",
    )

    first_identity = service.identify(first)
    second_identity = service.identify(second)

    assert first_identity.external_id == "place-42"
    assert first_identity.normalized_phone == "+573001234567"
    assert first_identity.root_domain == "cafe-bogota.com"
    assert first_identity.normalized_name_address == "cafe bogota|calle 10 5 20"
    assert set(first_identity.candidate_fingerprints) == set(second_identity.candidate_fingerprints)


def test_merge_preserves_non_empty_information_and_combines_collections():
    service = LeadDeduplicationService()
    primary = Lead(
        workspace_id="workspace-1",
        raw_source_id="place-1",
        name="Acme",
        phone="+57300",
        tags=["maps"],
    )
    duplicate = Lead(
        workspace_id="workspace-1",
        raw_source_id="place-1",
        name="Acme",
        email="hello@acme.test",
        website="https://acme.test",
        tags=["website"],
    )

    result = service.merge(primary, duplicate)

    assert result.lead.phone == "+57300"
    assert result.lead.email == "hello@acme.test"
    assert result.lead.website == "https://acme.test"
    assert result.lead.tags == ["maps", "website"]
    assert "email" in result.changed_fields


def test_deduplicate_merges_records_matching_any_identity():
    service = LeadDeduplicationService()
    first = Lead(workspace_id="workspace-1", raw_source_id=None, name="Acme", phone="300123")
    second = Lead(workspace_id="workspace-1", raw_source_id=None, name="Otra ficha", phone="300123")

    unique, merged_count = service.deduplicate([first, second])

    assert len(unique) == 1
    assert merged_count == 1
    assert unique[0].name == "Acme"
