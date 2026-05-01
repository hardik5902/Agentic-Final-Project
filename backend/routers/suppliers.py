import uuid
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
from schemas.supplier import SupplierCreate, SupplierUpdate, SupplierListResponse, ImportResult
from services import supplier_service
from services.auth_service import get_current_user

router = APIRouter()


@router.get("", response_model=SupplierListResponse)
def list_suppliers(
    category: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return supplier_service.list_suppliers(db, user, category, search)


@router.post("", status_code=201)
def create_supplier(
    body: SupplierCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return supplier_service.create_supplier(db, user, body)


@router.put("/{supplier_id}")
def update_supplier(
    supplier_id: uuid.UUID,
    body: SupplierUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return supplier_service.update_supplier(db, user, supplier_id, body)


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return supplier_service.delete_supplier(db, user, supplier_id)


@router.post("/import", response_model=ImportResult)
async def import_suppliers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    content = (await file.read()).decode("utf-8")
    return supplier_service.import_csv(db, user, content)


@router.get("/discover")
def discover_vendors(
    category: str,
    subcategory: str | None = None,
    country: str | None = None,
    limit: int = 10,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return {"items": supplier_service.discover_vendors(db, category, subcategory, country, limit)}
