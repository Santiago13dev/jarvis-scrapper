from app.application.services.lead_search_history_service import LeadSearchHistoryService


def test_record_search_keeps_a_single_recent_query_per_workspace():
    service = LeadSearchHistoryService()

    first = service.record_search(workspace_id="workspace-1", query="cafes bogota", filters={"with_email": True})
    second = service.record_search(workspace_id="workspace-1", query="cafes bogota", filters={"with_phone": True})

    assert first.query == "cafes bogota"
    assert second.query == "cafes bogota"
    assert second.filters == {"with_phone": True}


def test_list_recent_sorts_latest_searches_first():
    service = LeadSearchHistoryService()
    service.record_search(workspace_id="workspace-1", query="restaurantes bogota")
    service.record_search(workspace_id="workspace-1", query="hoteles medellin")
    service.record_search(workspace_id="workspace-2", query="abogados cali")

    history = service.list_recent(workspace_id="workspace-1", limit=5)

    assert [item["query"] for item in history][:2] == ["hoteles medellin", "restaurantes bogota"]
