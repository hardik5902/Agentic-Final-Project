import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, Float, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    website = Column(String(255))
    country = Column(String(100))
    categories = Column(ARRAY(String), default=list)
    tags = Column(ARRAY(String), default=list)
    notes = Column(Text)
    # performance stats
    total_invitations = Column(Integer, default=0)
    total_responses = Column(Integer, default=0)
    response_rate = Column(Float, default=0.0)
    avg_response_days = Column(Float)
    last_invited_at = Column(DateTime)
    last_responded_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("org_id", "email", name="uq_supplier_org_email"),)
