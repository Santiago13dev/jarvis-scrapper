"""add commercial follow-ups

Revision ID: 0005_lead_follow_ups
Revises: 0004_lead_deduplication
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_lead_follow_ups"
down_revision = "0004_lead_deduplication"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column("do_not_contact", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "lead_follow_ups",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lead_id", sa.String(36), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("next_follow_up_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.String(255), nullable=True),
    )
    op.create_index(
        "ix_lead_follow_ups_workspace_status_date",
        "lead_follow_ups",
        ["workspace_id", "status", "next_follow_up_at"],
    )
    op.create_index(
        "ix_lead_follow_ups_pending_date",
        "lead_follow_ups",
        ["next_follow_up_at"],
        postgresql_where=sa.text("status IN ('pending', 'due')"),
    )


def downgrade() -> None:
    op.drop_index("ix_lead_follow_ups_pending_date", table_name="lead_follow_ups")
    op.drop_index("ix_lead_follow_ups_workspace_status_date", table_name="lead_follow_ups")
    op.drop_table("lead_follow_ups")
    op.drop_column("leads", "do_not_contact")
