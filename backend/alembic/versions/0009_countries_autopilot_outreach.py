"""countries, autopilot rules and outreach drafts

Revision ID: 0009_autopilot_outreach
Revises: 0008_workspace_knowledge_base
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_autopilot_outreach"
down_revision = "0008_workspace_knowledge_base"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("country", sa.String(2), nullable=True))
    op.add_column("lead_import_jobs", sa.Column("country", sa.String(2), nullable=False, server_default="CO"))
    # Todos los leads existentes se extrajeron en Colombia
    op.execute("UPDATE leads SET country = 'CO' WHERE country IS NULL")
    # Teléfonos normalizados sin indicativo → E.164 colombiano, sin chocar con uno ya normalizado
    op.execute(
        """
        UPDATE leads AS l SET normalized_phone = '+57' || l.normalized_phone
        WHERE l.normalized_phone ~ '^[0-9]{10}$'
          AND NOT EXISTS (
            SELECT 1 FROM leads AS o
            WHERE o.workspace_id = l.workspace_id AND o.normalized_phone = '+57' || l.normalized_phone
          )
        """
    )
    # WhatsApp: celulares colombianos (10 dígitos que empiezan por 3)
    op.execute(
        """
        UPDATE leads SET whatsapp = '57' || regexp_replace(phone, '[^0-9]', '', 'g')
        WHERE whatsapp IS NULL AND regexp_replace(phone, '[^0-9]', '', 'g') ~ '^3[0-9]{9}$'
        """
    )

    op.create_table(
        "autopilot_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("keywords", sa.JSON(), nullable=False),
        sa.Column("locations", sa.JSON(), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.Column("frequency_hours", sa.Integer(), nullable=False),
        sa.Column("min_score", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_running", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_result", sa.JSON(), nullable=True),
        sa.Column("total_leads_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_autopilot_rules_active_next_run", "autopilot_rules", ["is_active", "next_run_at"])

    op.create_table(
        "outreach_drafts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_id", sa.String(36), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("to_phone", sa.String(32), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_outreach_drafts_workspace_status", "outreach_drafts", ["workspace_id", "status"])
    op.create_index("ix_outreach_drafts_lead", "outreach_drafts", ["lead_id"])


def downgrade() -> None:
    op.drop_index("ix_outreach_drafts_lead", table_name="outreach_drafts")
    op.drop_index("ix_outreach_drafts_workspace_status", table_name="outreach_drafts")
    op.drop_table("outreach_drafts")
    op.drop_index("ix_autopilot_rules_active_next_run", table_name="autopilot_rules")
    op.drop_table("autopilot_rules")
    op.drop_column("lead_import_jobs", "country")
    op.drop_column("leads", "country")
