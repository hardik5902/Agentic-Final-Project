import uuid
import csv
import io
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.supplier import Supplier
from models.user import User
from models.vendor import VendorDirectory
from schemas.supplier import SupplierCreate, SupplierUpdate


def list_suppliers(db: Session, user: User, category: str | None, search: str | None) -> dict:
    q = db.query(Supplier).filter(Supplier.org_id == user.org_id, Supplier.is_active == True)
    if category:
        q = q.filter(Supplier.categories.any(category))
    if search:
        q = q.filter(
            (Supplier.name.ilike(f"%{search}%")) | (Supplier.email.ilike(f"%{search}%"))
        )
    items = q.order_by(Supplier.name).all()
    return {"items": items, "total": len(items)}


def create_supplier(db: Session, user: User, body: SupplierCreate) -> Supplier:
    existing = db.query(Supplier).filter(
        Supplier.org_id == user.org_id,
        Supplier.email == body.email,
    ).first()
    if existing:
        raise HTTPException(400, "Supplier with this email already exists")

    supplier = Supplier(
        id=uuid.uuid4(),
        org_id=user.org_id,
        **body.model_dump(),
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


def update_supplier(db: Session, user: User, supplier_id: uuid.UUID, body: SupplierUpdate) -> Supplier:
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.org_id == user.org_id,
    ).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier


def delete_supplier(db: Session, user: User, supplier_id: uuid.UUID) -> dict:
    supplier = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.org_id == user.org_id,
    ).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")
    supplier.is_active = False
    db.commit()
    return {"deleted": True}


def import_csv(db: Session, user: User, csv_content: str) -> dict:
    reader = csv.DictReader(io.StringIO(csv_content))
    imported = 0
    skipped = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        try:
            email = row.get("email", "").strip()
            name = row.get("name", "").strip()
            if not email or not name:
                errors.append(f"Row {i}: name and email are required")
                skipped += 1
                continue

            existing = db.query(Supplier).filter(
                Supplier.org_id == user.org_id,
                Supplier.email == email,
            ).first()
            if existing:
                skipped += 1
                continue

            cats = [c.strip() for c in row.get("categories", "").split(",") if c.strip()]
            supplier = Supplier(
                id=uuid.uuid4(),
                org_id=user.org_id,
                name=name,
                email=email,
                website=row.get("website", "").strip() or None,
                country=row.get("country", "").strip() or None,
                categories=cats,
            )
            db.add(supplier)
            imported += 1
        except Exception as exc:
            errors.append(f"Row {i}: {exc}")
            skipped += 1

    db.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors}


def discover_vendors(db: Session, category: str, subcategory: str | None, country: str | None, limit: int) -> list:
    q = db.query(VendorDirectory).filter(VendorDirectory.categories.any(category))
    if subcategory:
        q = q.filter(VendorDirectory.subcategories.any(subcategory))
    if country:
        q = q.filter(VendorDirectory.country == country)
    return q.order_by(VendorDirectory.clutch_rating.desc().nullslast()).limit(limit).all()


def update_supplier_stats(db: Session, supplier_id: uuid.UUID) -> None:
    from models.invitation import Invitation
    from models.response import Response

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        return

    invitations = db.query(Invitation).filter(Invitation.supplier_id == supplier_id).all()
    responses = db.query(Response).filter(Response.supplier_id == supplier_id).all()

    total_inv = len(invitations)
    total_resp = len(responses)
    rate = (total_resp / total_inv) if total_inv > 0 else 0.0

    response_times = []
    for inv in invitations:
        if inv.responded_at and inv.email_sent_at:
            delta = (inv.responded_at - inv.email_sent_at).total_seconds() / 86400
            response_times.append(delta)

    supplier.total_invitations = total_inv
    supplier.total_responses = total_resp
    supplier.response_rate = round(rate, 3)
    supplier.avg_response_days = round(sum(response_times) / len(response_times), 1) if response_times else None
    db.commit()
