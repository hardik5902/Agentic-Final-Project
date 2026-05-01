import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    industry = Column(String(100))
    website = Column(String(255))
    country = Column(String(100), default="US")
    subscription_tier = Column(String(50), default="free")
    monthly_rfq_count = Column(Integer, default=0)
    monthly_rfq_reset_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
