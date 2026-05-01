import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from database import Base


class RFQEvent(Base):
    __tablename__ = "rfq_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String(500))
    category = Column(String(100))
    subcategory = Column(String(100))
    status = Column(String(50), default="draft")  # draft | active | closed | awarded | cancelled
    deadline = Column(DateTime)
    requirements = Column(JSONB, default=dict)
    criteria = Column(JSONB, default=list)
    rfq_document = Column(Text)
    rfq_document_pdf_url = Column(String)
    memo_text = Column(Text)
    memo_pdf_url = Column(String)
    awarded_supplier_id = Column(UUID(as_uuid=True))
    internal_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RFQConversation(Base):
    __tablename__ = "rfq_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfq_events.id", ondelete="CASCADE"), nullable=False)
    messages = Column(JSONB, default=list)
    template_used = Column(String(100))
    fields_collected = Column(JSONB, default=dict)
    fields_remaining = Column(JSONB, default=list)
    is_complete = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
