import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, Float, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from database import Base


class VendorDirectory(Base):
    __tablename__ = "vendor_directory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    website = Column(String(255))
    country = Column(String(100))
    city = Column(String(100))
    categories = Column(ARRAY(String), default=list)
    subcategories = Column(ARRAY(String), default=list)
    description = Column(Text)
    employee_range = Column(String(50))
    founded_year = Column(Integer)
    clutch_rating = Column(Float)
    clutch_reviews_count = Column(Integer)
    g2_rating = Column(Float)
    g2_reviews_count = Column(Integer)
    verified = Column(Boolean, default=False)
    source = Column(String(100))  # clutch | g2 | manual | customer_added
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
