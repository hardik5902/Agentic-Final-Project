"""
Internal Cloud Tasks endpoints — restricted to GCP internal traffic, OIDC auth.
"""

import io
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.invitation import Invitation
from models.rfq import RFQEvent
from models.supplier import Supplier
from services import email_service, storage_service, supplier_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal/tasks")


async def _verify_oidc(request: Request) -> None:
    """Validate Cloud Tasks OIDC token. Skip in local dev."""
    if settings.API_BASE_URL.startswith("http://localhost"):
        return
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing OIDC token")
    # In production, Google verifies the OIDC token at Cloud Run ingress.
    # We trust it here since /internal/* is not publicly reachable.


class SendInvitationPayload(BaseModel):
    invitation_id: str
    supplier_email: str
    supplier_name: str
    rfq_title: str
    deadline: str
    portal_token: str
    buyer_company: str


class GeneratePDFPayload(BaseModel):
    rfq_id: str
    type: str  # "rfq" | "memo"
    content: str


class NotifyResponsePayload(BaseModel):
    rfq_id: str
    supplier_name: str
    response_count: int
    invited_count: int
    buyer_email: str | None = None
    buyer_name: str | None = None


class PolishRFQPayload(BaseModel):
    rfq_id: str
    org_name: str


class UpdateStatsPayload(BaseModel):
    supplier_id: str


class SendReminderPayload(BaseModel):
    invitation_id: str
    days_remaining: int


@router.post("/send-invitation")
async def send_invitation(
    payload: SendInvitationPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    await _verify_oidc(request)
    email_service.send_supplier_invitation(
        supplier_email=payload.supplier_email,
        supplier_name=payload.supplier_name,
        rfq_title=payload.rfq_title,
        deadline=payload.deadline,
        portal_token=payload.portal_token,
        buyer_company=payload.buyer_company,
    )
    inv = db.query(Invitation).filter(Invitation.id == payload.invitation_id).first()
    if inv:
        inv.email_sent_at = datetime.utcnow()
        db.commit()
    return {"sent": True}


@router.post("/generate-pdf")
async def generate_pdf(
    payload: GeneratePDFPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    await _verify_oidc(request)
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=payload.content).write_pdf()
    except Exception as exc:
        logger.error("WeasyPrint failed: %s", exc)
        return {"error": str(exc)}

    if payload.type == "rfq":
        gcs_path = f"rfq-documents/{payload.rfq_id}/rfq.pdf"
    else:
        gcs_path = f"decision-memos/{payload.rfq_id}/memo.pdf"

    try:
        storage_service.upload_bytes(pdf_bytes, gcs_path, "application/pdf")
    except Exception as exc:
        logger.error("PDF upload failed for %s: %s", payload.rfq_id, exc)
        return {"error": f"pdf upload failed: {exc}", "gcs_path": None}

    rfq = db.query(RFQEvent).filter(RFQEvent.id == payload.rfq_id).first()
    if rfq:
        if payload.type == "rfq":
            rfq.rfq_document_pdf_url = gcs_path
        else:
            rfq.memo_pdf_url = gcs_path
        db.commit()

    return {"gcs_path": gcs_path}


@router.post("/polish-rfq")
async def polish_rfq(
    payload: PolishRFQPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    """Replace deterministic draft with AI-polished version in the background."""
    await _verify_oidc(request)
    import uuid
    from services import ai_service
    from templates.loader import load_template

    rfq = db.query(RFQEvent).filter(RFQEvent.id == uuid.UUID(payload.rfq_id)).first()
    if not rfq or not rfq.requirements:
        return {"polished": False, "reason": "rfq not found or no requirements"}

    template = load_template(rfq.category or "professional_services")
    try:
        polished = await ai_service.generate_rfq_document(rfq.requirements, template, payload.org_name)
        if polished:
            rfq.rfq_document = polished
            db.commit()
            logger.info("polish-rfq done rfq=%s doc_len=%d", payload.rfq_id, len(polished))
    except Exception as exc:
        logger.error("polish-rfq failed rfq=%s: %s", payload.rfq_id, exc)

    return {"polished": True}


@router.post("/notify-response-received")
async def notify_response(
    payload: NotifyResponsePayload,
    request: Request,
    db: Session = Depends(get_db),
):
    await _verify_oidc(request)
    if payload.buyer_email:
        email_service.send_response_received(
            buyer_email=payload.buyer_email,
            buyer_name=payload.buyer_name or "there",
            supplier_name=payload.supplier_name,
            rfq_title=payload.rfq_id,
            response_count=payload.response_count,
            invited_count=payload.invited_count,
        )
    return {"sent": True}


@router.post("/update-supplier-stats")
async def update_stats(
    payload: UpdateStatsPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    await _verify_oidc(request)
    import uuid
    supplier_service.update_supplier_stats(db, uuid.UUID(payload.supplier_id))
    return {"updated": True}


@router.post("/send-deadline-reminder")
async def send_reminder(
    payload: SendReminderPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    await _verify_oidc(request)
    inv = db.query(Invitation).filter(Invitation.id == payload.invitation_id).first()
    if not inv:
        return {"sent": False}

    already_sent = (
        (payload.days_remaining == 3 and inv.reminder_1_sent_at) or
        (payload.days_remaining == 1 and inv.reminder_2_sent_at)
    )
    if already_sent:
        return {"sent": False, "reason": "already sent"}

    supplier = db.query(Supplier).filter(Supplier.id == inv.supplier_id).first()
    rfq = db.query(RFQEvent).filter(RFQEvent.id == inv.rfq_id).first()
    if supplier and rfq:
        email_service.send_deadline_reminder(
            supplier_email=supplier.email,
            supplier_name=supplier.name,
            rfq_title=rfq.title or "RFQ",
            deadline=rfq.deadline.strftime("%Y-%m-%d") if rfq.deadline else "",
            portal_token=inv.token,
            days_remaining=payload.days_remaining,
        )
        if payload.days_remaining == 3:
            inv.reminder_1_sent_at = datetime.utcnow()
        else:
            inv.reminder_2_sent_at = datetime.utcnow()
        db.commit()

    return {"sent": True}


@router.post("/check-reminders")
async def check_reminders(request: Request, db: Session = Depends(get_db)):
    """Triggered by Cloud Scheduler daily at 9am UTC."""
    await _verify_oidc(request)
    from services.cloud_tasks import create_task
    now = datetime.utcnow()
    queued = 0

    active_rfqs = db.query(RFQEvent).filter(RFQEvent.status == "active").all()
    for rfq in active_rfqs:
        if not rfq.deadline:
            continue
        days_left = (rfq.deadline - now).days
        if days_left not in (1, 3):
            continue

        pending_invs = db.query(Invitation).filter(
            Invitation.rfq_id == rfq.id,
            Invitation.status.in_(["invited", "viewed"]),
        ).all()
        for inv in pending_invs:
            create_task("send-deadline-reminder", {
                "invitation_id": str(inv.id),
                "days_remaining": days_left,
            })
            queued += 1

    return {"reminders_queued": queued}
