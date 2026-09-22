from datetime import datetime, timezone

from app.domain.entities.lead import Lead, LeadStatus


def test_contacted_is_a_status_only_and_does_not_send_messages():
    lead = Lead(workspace_id="workspace-1", raw_source_id=None, name="Acme")

    lead.change_status(LeadStatus.CONTACTED)

    assert lead.status is LeadStatus.CONTACTED
    assert lead.tasks == []


def test_do_not_contact_is_explicit_and_preserved():
    lead = Lead(workspace_id="workspace-1", raw_source_id=None, name="Acme", do_not_contact=True)

    assert lead.do_not_contact is True
    assert datetime.now(timezone.utc) >= lead.updated_at
