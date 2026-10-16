"""autopilot run progress

Revision ID: 0011_autopilot_progress
Revises: 0010_workspace_settings
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_autopilot_progress"
down_revision = "0010_workspace_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("autopilot_rules", sa.Column("progress", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("autopilot_rules", "progress")
