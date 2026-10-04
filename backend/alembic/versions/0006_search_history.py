"""add workspace lead search history

Revision ID: 0006_search_history
Revises: 0005_lead_follow_ups
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_search_history"
down_revision = "0005_lead_follow_ups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_search_history",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("workspace_id", sa.String(length=36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query", sa.String(length=255), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_lead_search_history_workspace_updated", "lead_search_history", ["workspace_id", "updated_at"])
    op.create_index("ix_lead_search_history_workspace_query", "lead_search_history", ["workspace_id", "query"])


def downgrade() -> None:
    op.drop_index("ix_lead_search_history_workspace_query", table_name="lead_search_history")
    op.drop_index("ix_lead_search_history_workspace_updated", table_name="lead_search_history")
    op.drop_table("lead_search_history")
