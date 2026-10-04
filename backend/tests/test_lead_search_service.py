from app.application.services.lead_search_service import LeadSearchService
from app.domain.entities.lead import Lead


def test_lead_search_service_prioritizes_exact_name_and_email_matches():
    service = LeadSearchService()
    leads = [
        Lead(
            workspace_id="workspace-1",
            name="Restaurante El Dorado",
            raw_source_id="place-1",
            website="https://eldorado.test",
            email="hola@eldorado.test",
            category="Restaurante",
            address="Bogotá, Colombia",
        ),
        Lead(
            workspace_id="workspace-1",
            name="Hotel Andino",
            raw_source_id="place-2",
            website="https://andino.test",
            email="booking@andino.test",
            category="Hoteles",
            address="Medellín, Colombia",
        ),
        Lead(
            workspace_id="workspace-1",
            name="Cafe de la esquina",
            raw_source_id="place-3",
            website="https://cafe.test",
            email="contacto@cafe.test",
            category="Cafetería",
            address="Bogotá, Colombia",
        ),
    ]

    result = service.filter_and_rank(leads, query="eldorado")

    assert result[0].name == "Restaurante El Dorado"
    assert result[0].email == "hola@eldorado.test"


def test_lead_search_service_detects_phone_and_category_tokens():
    service = LeadSearchService()
    leads = [
        Lead(
            workspace_id="workspace-1",
            name="Abarrotes del Sur",
            raw_source_id="place-9",
            phone="+57 3001234567",
            category="Supermercado",
        ),
        Lead(
            workspace_id="workspace-1",
            name="Clinica Central",
            raw_source_id="place-10",
            phone="+57 3117654321",
            category="Salud",
        ),
    ]

    result = service.filter_and_rank(leads, query="3001234567 supermercado")

    assert result[0].name == "Abarrotes del Sur"
    assert result[0].category == "Supermercado"
