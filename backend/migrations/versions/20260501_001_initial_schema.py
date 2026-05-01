"""initial_schema

Revision ID: 20260501_001
Revises:
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "20260501_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("industry", sa.String(100)),
        sa.Column("website", sa.String(255)),
        sa.Column("country", sa.String(100), server_default="US"),
        sa.Column("subscription_tier", sa.String(50), server_default="free"),
        sa.Column("monthly_rfq_count", sa.Integer, server_default="0"),
        sa.Column("monthly_rfq_reset_date", sa.Date),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255)),
        sa.Column("role", sa.String(50), server_default="buyer"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_login", sa.DateTime),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "rfq_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("title", sa.String(500)),
        sa.Column("category", sa.String(100)),
        sa.Column("subcategory", sa.String(100)),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("deadline", sa.DateTime),
        sa.Column("requirements", JSONB, server_default="{}"),
        sa.Column("criteria", JSONB, server_default="[]"),
        sa.Column("rfq_document", sa.Text),
        sa.Column("rfq_document_pdf_url", sa.String),
        sa.Column("memo_text", sa.Text),
        sa.Column("memo_pdf_url", sa.String),
        sa.Column("awarded_supplier_id", UUID(as_uuid=True)),
        sa.Column("internal_notes", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "rfq_conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("rfq_id", UUID(as_uuid=True), sa.ForeignKey("rfq_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("messages", JSONB, server_default="[]"),
        sa.Column("template_used", sa.String(100)),
        sa.Column("fields_collected", JSONB, server_default="{}"),
        sa.Column("fields_remaining", JSONB, server_default="[]"),
        sa.Column("is_complete", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "suppliers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("website", sa.String(255)),
        sa.Column("country", sa.String(100)),
        sa.Column("categories", ARRAY(sa.String), server_default="{}"),
        sa.Column("tags", ARRAY(sa.String), server_default="{}"),
        sa.Column("notes", sa.Text),
        sa.Column("total_invitations", sa.Integer, server_default="0"),
        sa.Column("total_responses", sa.Integer, server_default="0"),
        sa.Column("response_rate", sa.Float, server_default="0"),
        sa.Column("avg_response_days", sa.Float),
        sa.Column("last_invited_at", sa.DateTime),
        sa.Column("last_responded_at", sa.DateTime),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "email", name="uq_supplier_org_email"),
    )

    op.create_table(
        "invitations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("rfq_id", UUID(as_uuid=True), sa.ForeignKey("rfq_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("suppliers.id"), nullable=False),
        sa.Column("token", sa.String(64), unique=True, nullable=False),
        sa.Column("status", sa.String(50), server_default="invited"),
        sa.Column("email_sent_at", sa.DateTime),
        sa.Column("reminder_1_sent_at", sa.DateTime),
        sa.Column("reminder_2_sent_at", sa.DateTime),
        sa.Column("viewed_at", sa.DateTime),
        sa.Column("responded_at", sa.DateTime),
        sa.Column("declined_at", sa.DateTime),
        sa.Column("decline_reason", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "responses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invitation_id", UUID(as_uuid=True), sa.ForeignKey("invitations.id")),
        sa.Column("rfq_id", UUID(as_uuid=True), sa.ForeignKey("rfq_events.id")),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("suppliers.id")),
        sa.Column("raw_data", JSONB, nullable=False, server_default="{}"),
        sa.Column("normalized_data", JSONB, server_default="{}"),
        sa.Column("score", sa.Float),
        sa.Column("score_breakdown", JSONB, server_default="{}"),
        sa.Column("flags", JSONB, server_default="[]"),
        sa.Column("eliminated", sa.Boolean, server_default="false"),
        sa.Column("elimination_reason", sa.Text),
        sa.Column("buyer_ratings", JSONB, server_default="{}"),
        sa.Column("buyer_notes", sa.Text),
        sa.Column("attachment_urls", JSONB, server_default="[]"),
        sa.Column("submitted_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "supplier_questions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("rfq_id", UUID(as_uuid=True), sa.ForeignKey("rfq_events.id")),
        sa.Column("invitation_id", UUID(as_uuid=True), sa.ForeignKey("invitations.id")),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("suppliers.id")),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("answer", sa.Text),
        sa.Column("answered_by", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("is_shared_with_all", sa.Boolean, server_default="true"),
        sa.Column("asked_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("answered_at", sa.DateTime),
    )

    op.create_table(
        "vendor_directory",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255)),
        sa.Column("website", sa.String(255)),
        sa.Column("country", sa.String(100)),
        sa.Column("city", sa.String(100)),
        sa.Column("categories", ARRAY(sa.String), server_default="{}"),
        sa.Column("subcategories", ARRAY(sa.String), server_default="{}"),
        sa.Column("description", sa.Text),
        sa.Column("employee_range", sa.String(50)),
        sa.Column("founded_year", sa.Integer),
        sa.Column("clutch_rating", sa.Float),
        sa.Column("clutch_reviews_count", sa.Integer),
        sa.Column("g2_rating", sa.Float),
        sa.Column("g2_reviews_count", sa.Integer),
        sa.Column("verified", sa.Boolean, server_default="false"),
        sa.Column("source", sa.String(100)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Indexes
    op.create_index("idx_rfq_events_org_id", "rfq_events", ["org_id"])
    op.create_index("idx_rfq_events_status", "rfq_events", ["status"])
    op.create_index("idx_rfq_events_created_at", "rfq_events", ["created_at"])
    op.create_index("idx_invitations_rfq_id", "invitations", ["rfq_id"])
    op.create_index("idx_invitations_token", "invitations", ["token"])
    op.create_index("idx_invitations_status", "invitations", ["status"])
    op.create_index("idx_responses_rfq_id", "responses", ["rfq_id"])
    op.create_index("idx_responses_supplier_id", "responses", ["supplier_id"])
    op.create_index("idx_suppliers_org_id", "suppliers", ["org_id"])
    op.create_index("idx_rfq_conversations_rfq_id", "rfq_conversations", ["rfq_id"])


def downgrade() -> None:
    op.drop_table("vendor_directory")
    op.drop_table("supplier_questions")
    op.drop_table("responses")
    op.drop_table("invitations")
    op.drop_table("suppliers")
    op.drop_table("rfq_conversations")
    op.drop_table("rfq_events")
    op.drop_table("users")
    op.drop_table("organizations")
