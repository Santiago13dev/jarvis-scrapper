"""import jobs in background, listing url and outreach tracking

Revision ID: 0007_import_jobs_outreach
Revises: 0006_search_history
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_import_jobs_outreach"
down_revision = "0006_search_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ficha en directorio (Restaurant Guru, Tripadvisor…) que Google Maps mostraba como "sitio web".
    op.add_column("leads", sa.Column("listing_url", sa.String(length=500), nullable=True))
    # Seguimiento de contacto para la cola diaria y las automatizaciones.
    op.add_column("leads", sa.Column("last_contacted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("leads", sa.Column("contact_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.create_index("ix_leads_workspace_status_score", "leads", ["workspace_id", "status", "lead_score"])

    # Búsquedas de Google Maps que corren en segundo plano (worker ARQ).
    op.create_table(
        "lead_import_jobs",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("workspace_id", sa.String(length=36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("keyword", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("max_results", sa.Integer(), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("extract_emails", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("stage", sa.String(length=40), nullable=True),
        sa.Column("found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imported", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_lead_import_jobs_workspace_created", "lead_import_jobs", ["workspace_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_lead_import_jobs_workspace_created", table_name="lead_import_jobs")
    op.drop_table("lead_import_jobs")
    op.drop_index("ix_leads_workspace_status_score", table_name="leads")
    op.drop_column("leads", "contact_attempts")
    op.drop_column("leads", "last_contacted_at")
    op.drop_column("leads", "listing_url")
