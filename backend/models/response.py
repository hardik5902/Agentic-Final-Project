import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from database import Base


class Response(Base):
    __tablename__ = "responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invitation_id = Column(UUID(as_uuid=True), ForeignKey("invitations.id"))
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfq_events.id"))
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    raw_data = Column(JSONB, nullable=False, default=dict)
    normalized_data = Column(JSONB, default=dict)
    score = Column(Float)
    score_breakdown = Column(JSONB, default=dict)
    flags = Column(JSONB, default=list)
    eliminated = Column(Boolean, default=False)
    elimination_reason = Column(Text)
    buyer_ratings = Column(JSONB, default=dict)
    buyer_notes = Column(Text)
    attachment_urls = Column(JSONB, default=list)
    submitted_at = Column(DateTime, default=datetime.utcnow)


class SupplierQuestion(Base):
    __tablename__ = "supplier_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfq_events.id"))
    invitation_id = Column(UUID(as_uuid=True), ForeignKey("invitations.id"))
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    question = Column(Text, nullable=False)
    answer = Column(Text)
    answered_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_shared_with_all = Column(Boolean, default=True)
    asked_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime)
