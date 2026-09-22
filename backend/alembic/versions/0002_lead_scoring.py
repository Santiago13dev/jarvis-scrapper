"""persist deterministic lead scoring and web audits

Revision ID: 0002_lead_scoring
Revises: 0001_initial_schema
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_lead_scoring"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("score_level", sa.String(10), nullable=True))
    op.add_column("leads", sa.Column("score_reasons", sa.JSON(), nullable=True))
    op.add_column("leads", sa.Column("score_niche", sa.String(100), nullable=True))
    op.add_column("leads", sa.Column("score_calculated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "lead_web_audits",
        sa.Column("lead_id", sa.String(36), sa.ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("website_reachable", sa.Boolean(), nullable=True),
        sa.Column("https_enabled", sa.Boolean(), nullable=True),
        sa.Column("has_title", sa.Boolean(), nullable=True),
        sa.Column("has_meta_description", sa.Boolean(), nullable=True),
        sa.Column("mobile_friendly", sa.Boolean(), nullable=True),
        sa.Column("load_time_ms", sa.Integer(), nullable=True),
        sa.Column("audited_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "lead_scoring_configs",
        sa.Column("niche", sa.String(100), primary_key=True),
        sa.Column("weights", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("lead_scoring_configs")
    op.drop_table("lead_web_audits")
    op.drop_column("leads", "score_calculated_at")
    op.drop_column("leads", "score_niche")
    op.drop_column("leads", "score_reasons")
    op.drop_column("leads", "score_level")
