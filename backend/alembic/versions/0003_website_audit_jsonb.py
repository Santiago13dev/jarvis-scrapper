"""store complete website audit result as JSONB

Revision ID: 0003_website_audit_jsonb
Revises: 0002_lead_scoring
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_website_audit_jsonb"
down_revision = "0002_lead_scoring"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lead_web_audits", sa.Column("result", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("lead_web_audits", "result")
