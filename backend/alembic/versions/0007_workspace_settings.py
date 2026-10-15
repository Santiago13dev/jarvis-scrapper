"""workspace commercial settings

Revision ID: 0007_workspace_settings
Revises: 0006_autopilot_outreach
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_workspace_settings"
down_revision = "0006_autopilot_outreach"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("workspaces", sa.Column("outreach_signature", sa.String(120), nullable=False, server_default="— Equipo Jarvis IA"))
    op.add_column("workspaces", sa.Column("daily_send_limit", sa.Integer(), nullable=False, server_default="40"))
    op.add_column("workspaces", sa.Column("follow_up_days", sa.Integer(), nullable=False, server_default="3"))
    op.add_column("workspaces", sa.Column("min_score", sa.Integer(), nullable=False, server_default="70"))
    op.add_column("workspaces", sa.Column("knowledge_base", sa.Text(), nullable=True))


def downgrade() -> None:
    for column in ("knowledge_base", "min_score", "follow_up_days", "daily_send_limit", "outreach_signature"):
        op.drop_column("workspaces", column)
