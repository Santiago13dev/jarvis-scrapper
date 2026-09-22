"""add normalized lead deduplication identities

Revision ID: 0004_lead_deduplication
Revises: 0003_website_audit_jsonb
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_lead_deduplication"
down_revision = "0003_website_audit_jsonb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("external_id", sa.String(255), nullable=True))
    op.add_column("leads", sa.Column("normalized_phone", sa.String(32), nullable=True))
    op.add_column("leads", sa.Column("root_domain", sa.String(255), nullable=True))
    op.add_column("leads", sa.Column("normalized_name_address", sa.String(600), nullable=True))
    op.add_column("leads", sa.Column("dedupe_fingerprint", sa.String(64), nullable=True))
    op.execute("UPDATE leads SET external_id = raw_source_id WHERE raw_source_id IS NOT NULL")

    op.create_index(
        "uq_leads_workspace_external_id",
        "leads",
        ["workspace_id", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )
    op.create_index(
        "uq_leads_workspace_normalized_phone",
        "leads",
        ["workspace_id", "normalized_phone"],
        unique=True,
        postgresql_where=sa.text("normalized_phone IS NOT NULL"),
    )
    op.create_index(
        "uq_leads_workspace_root_domain",
        "leads",
        ["workspace_id", "root_domain"],
        unique=True,
        postgresql_where=sa.text("root_domain IS NOT NULL"),
    )
    op.create_index(
        "uq_leads_workspace_name_address",
        "leads",
        ["workspace_id", "normalized_name_address"],
        unique=True,
        postgresql_where=sa.text("normalized_name_address IS NOT NULL"),
    )
    op.create_index(
        "ix_leads_workspace_dedupe_fingerprint",
        "leads",
        ["workspace_id", "dedupe_fingerprint"],
    )


def downgrade() -> None:
    op.drop_index("ix_leads_workspace_dedupe_fingerprint", table_name="leads")
    op.drop_index("uq_leads_workspace_name_address", table_name="leads")
    op.drop_index("uq_leads_workspace_root_domain", table_name="leads")
    op.drop_index("uq_leads_workspace_normalized_phone", table_name="leads")
    op.drop_index("uq_leads_workspace_external_id", table_name="leads")
    op.drop_column("leads", "dedupe_fingerprint")
    op.drop_column("leads", "normalized_name_address")
    op.drop_column("leads", "root_domain")
    op.drop_column("leads", "normalized_phone")
    op.drop_column("leads", "external_id")
