from datetime import datetime
from pydantic import BaseModel, EmailStr, UUID4


class SupplierCreate(BaseModel):
    name: str
    email: EmailStr
    website: str | None = None
    country: str | None = None
    categories: list[str] = []
    tags: list[str] = []
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    country: str | None = None
    categories: list[str] | None = None
    tags: list[str] | None = None
    notes: str | None = None


class SupplierOut(BaseModel):
    id: UUID4
    name: str
    email: str
    website: str | None
    country: str | None
    categories: list[str]
    response_rate: float
    total_invitations: int
    total_responses: int
    last_responded_at: datetime | None

    class Config:
        from_attributes = True


class SupplierListResponse(BaseModel):
    items: list[SupplierOut]
    total: int


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


class VendorDirectoryItem(BaseModel):
    id: UUID4
    name: str
    email: str | None
    website: str | None
    country: str | None
    categories: list[str]
    description: str | None
    clutch_rating: float | None
    verified: bool

    class Config:
        from_attributes = True
