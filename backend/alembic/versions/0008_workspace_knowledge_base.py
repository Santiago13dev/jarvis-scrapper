"""workspace knowledge base for the AI agent

Revision ID: 0008_workspace_knowledge_base
Revises: 0007_import_jobs_outreach
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_workspace_knowledge_base"
down_revision = "0007_import_jobs_outreach"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Antes solo vivía en Redis (kb:{workspace_id}) y se perdía al reiniciar.
    op.add_column("workspaces", sa.Column("knowledge_base", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("workspaces", "knowledge_base")
