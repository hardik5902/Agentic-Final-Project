import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("rfq_events.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    token = Column(String(64), unique=True, nullable=False)
    status = Column(String(50), default="invited")  # invited | viewed | responded | declined | bounced
    email_sent_at = Column(DateTime)
    reminder_1_sent_at = Column(DateTime)
    reminder_2_sent_at = Column(DateTime)
    viewed_at = Column(DateTime)
    responded_at = Column(DateTime)
    declined_at = Column(DateTime)
    decline_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
