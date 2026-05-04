"""
Supplier portal endpoints — authenticated by URL token, not JWT.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.invitation import Invitation
from models.rfq import RFQEvent
from models.response import Response, SupplierQuestion
from models.supplier import Supplier
from models.organization import Organization
from schemas.response import (
    SubmitResponseRequest,
    SubmitResponseResult,
    QuestionRequest,
    QuestionResult,
    SupplierPortalInboxResponse,
)
from services.cloud_tasks import create_task
from templates.loader import load_template

router = APIRouter()


def _get_invitation(db: Session, token: str, allow_responded: bool = False) -> Invitation:
    inv = db.query(Invitation).filter(Invitation.token == token).first()
    if not inv:
        raise HTTPException(404, "Invalid or expired link")
    if inv.status == "responded" and not allow_responded:
        raise HTTPException(400, "Response already submitted")
    return inv


def _mark_invitation_viewed(db: Session, inv: Invitation) -> None:
    if inv.status == "invited":
        inv.status = "viewed"
        inv.viewed_at = datetime.utcnow()
        db.commit()


@router.get("/{token}/portal", response_model=SupplierPortalInboxResponse)
def get_supplier_portal(token: str, db: Session = Depends(get_db)):
    inv = _get_invitation(db, token, allow_responded=True)
    _mark_invitation_viewed(db, inv)

    supplier = db.query(Supplier).filter(Supplier.id == inv.supplier_id).first()
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    invitations = (
        db.query(Invitation)
        .filter(Invitation.supplier_id == inv.supplier_id)
        .order_by(Invitation.created_at.desc())
        .all()
    )

    now = datetime.utcnow()
    invitation_rows = []
    for item in invitations:
        rfq = db.query(RFQEvent).filter(RFQEvent.id == item.rfq_id).first()
        if not rfq:
            continue

        org = db.query(Organization).filter(Organization.id == rfq.org_id).first()
        latest_response = (
            db.query(Response)
            .filter(Response.invitation_id == item.id)
            .order_by(Response.submitted_at.desc())
            .first()
        )

        already_submitted = item.status == "responded" and latest_response is not None
        deadline_passed = bool(rfq.deadline and rfq.deadline < now)
        is_closed = rfq.status in ("closed", "awarded") or deadline_passed
        can_open = already_submitted or not deadline_passed
        can_edit = already_submitted and not is_closed

        invitation_rows.append({
            "invitation_token": item.token,
            "rfq_id": rfq.id,
            "rfq_title": rfq.title,
            "buyer_company": org.name if org else None,
            "category": rfq.category,
            "deadline": rfq.deadline,
            "rfq_status": rfq.status,
            "invitation_status": item.status,
            "already_submitted": already_submitted,
            "is_closed": is_closed,
            "can_open": can_open,
            "can_edit": can_edit,
            "responded_at": item.responded_at,
            "updated_at": latest_response.submitted_at if latest_response else None,
            "created_at": item.created_at,
        })

    return SupplierPortalInboxResponse(
        supplier_name=supplier.name,
        supplier_email=supplier.email,
        invitations=invitation_rows,
    )


@router.get("/{token}")
def get_rfq_for_supplier(token: str, db: Session = Depends(get_db)):
    # allow_responded=True so suppliers can view and edit their response after submitting
    inv = _get_invitation(db, token, allow_responded=True)
    rfq = db.query(RFQEvent).filter(RFQEvent.id == inv.rfq_id).first()
    if not rfq:
        raise HTTPException(404, "RFQ not found")

    already_submitted = inv.status == "responded"
    rfq_closed = rfq.status in ("closed", "awarded")

    if not already_submitted and rfq_closed:
        raise HTTPException(400, "RFQ is closed")

    # Only block access for non-submitted suppliers when deadline has passed
    if not already_submitted and rfq.deadline and rfq.deadline < datetime.utcnow():
        raise HTTPException(400, "RFQ deadline has passed")

    # Mark as viewed on first access
    _mark_invitation_viewed(db, inv)

    org = db.query(Organization).filter(Organization.id == rfq.org_id).first()
    template = load_template(rfq.category or "professional_services")

    # Answered questions shared with all suppliers
    questions = db.query(SupplierQuestion).filter(
        SupplierQuestion.rfq_id == rfq.id,
        SupplierQuestion.is_shared_with_all == True,
        SupplierQuestion.answer != None,
    ).all()

    # This supplier's own confidential questions (answered or pending)
    my_questions = db.query(SupplierQuestion).filter(
        SupplierQuestion.rfq_id == rfq.id,
        SupplierQuestion.invitation_id == inv.id,
        SupplierQuestion.is_shared_with_all == False,
    ).order_by(SupplierQuestion.asked_at.asc()).all()

    # Fetch submitted response data so the form can be pre-filled
    submitted_data = None
    if already_submitted:
        existing = db.query(Response).filter(
            Response.invitation_id == inv.id
        ).order_by(Response.submitted_at.desc()).first()
        if existing:
            submitted_data = existing.raw_data

    return {
        "rfq": {
            "title": rfq.title,
            "rfq_document": rfq.rfq_document,
            "deadline": rfq.deadline,
            "buyer_company": org.name if org else None,
            "requirements": rfq.requirements,
        },
        "form_fields": template.get("response_form_fields", []),
        "answered_questions": [
            {"question": q.question, "answer": q.answer, "answered_at": q.answered_at}
            for q in questions
        ],
        "my_questions": [
            {
                "question": q.question,
                "answer": q.answer,
                "answered_at": q.answered_at,
                "asked_at": q.asked_at,
            }
            for q in my_questions
        ],
        "already_submitted": already_submitted,
        "rfq_status": rfq.status,
        "submitted_data": submitted_data,
    }


@router.post("/{token}", response_model=SubmitResponseResult)
def submit_response(
    token: str,
    body: SubmitResponseRequest,
    db: Session = Depends(get_db),
):
    inv = _get_invitation(db, token)
    rfq = db.query(RFQEvent).filter(RFQEvent.id == inv.rfq_id).first()
    if rfq and rfq.status in ("closed", "awarded"):
        raise HTTPException(400, "RFQ is closed")
    if rfq and rfq.deadline and rfq.deadline < datetime.utcnow():
        raise HTTPException(400, "RFQ deadline has passed")

    response = Response(
        id=uuid.uuid4(),
        invitation_id=inv.id,
        rfq_id=inv.rfq_id,
        supplier_id=inv.supplier_id,
        raw_data=body.data,
        attachment_urls=body.attachment_gcs_paths,
    )
    db.add(response)

    inv.status = "responded"
    inv.responded_at = datetime.utcnow()

    supplier = db.query(Supplier).filter(Supplier.id == inv.supplier_id).first()
    if supplier:
        supplier.last_responded_at = datetime.utcnow()

    db.commit()

    # Background: notify buyer, update supplier stats
    if rfq:
        total_responses = db.query(Response).filter(Response.rfq_id == rfq.id).count()
        total_invited = db.query(Invitation).filter(Invitation.rfq_id == rfq.id).count()
        create_task("notify-response-received", {
            "rfq_id": str(rfq.id),
            "supplier_name": supplier.name if supplier else "Supplier",
            "response_count": total_responses,
            "invited_count": total_invited,
        })
    if supplier:
        create_task("update-supplier-stats", {"supplier_id": str(supplier.id)})

    return SubmitResponseResult(status="submitted", message="Thank you — your response has been submitted.")


@router.put("/{token}", response_model=SubmitResponseResult)
def update_response(
    token: str,
    body: SubmitResponseRequest,
    db: Session = Depends(get_db),
):
    inv = _get_invitation(db, token, allow_responded=True)
    if inv.status != "responded":
        raise HTTPException(400, "No submitted response to update")

    rfq = db.query(RFQEvent).filter(RFQEvent.id == inv.rfq_id).first()
    if rfq and rfq.status in ("closed", "awarded"):
        raise HTTPException(400, "RFQ is closed — response cannot be updated")
    if rfq and rfq.deadline and rfq.deadline < datetime.utcnow():
        raise HTTPException(400, "RFQ deadline has passed")

    existing = db.query(Response).filter(
        Response.invitation_id == inv.id
    ).order_by(Response.submitted_at.desc()).first()
    if not existing:
        raise HTTPException(404, "Submitted response not found")

    existing.raw_data = body.data
    if body.attachment_gcs_paths:
        existing.attachment_urls = body.attachment_gcs_paths
    existing.submitted_at = datetime.utcnow()

    # Clear stale computed fields so normalize/score re-run picks up the new data
    existing.normalized_data = None
    existing.score = None
    existing.score_breakdown = None
    existing.flags = None
    existing.eliminated = False
    existing.elimination_reason = None

    db.commit()

    return SubmitResponseResult(status="updated", message="Your response has been updated successfully.")


@router.post("/{token}/question", response_model=QuestionResult)
def ask_question(
    token: str,
    body: QuestionRequest,
    db: Session = Depends(get_db),
):
    inv = _get_invitation(db, token)
    rfq = db.query(RFQEvent).filter(RFQEvent.id == inv.rfq_id).first()
    if rfq and rfq.status in ("closed", "awarded"):
        raise HTTPException(400, "RFQ is closed")

    q = SupplierQuestion(
        id=uuid.uuid4(),
        rfq_id=inv.rfq_id,
        invitation_id=inv.id,
        supplier_id=inv.supplier_id,
        question=body.question,
        is_shared_with_all=False,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return QuestionResult(
        question_id=q.id,
        status="submitted",
        message="Your question has been sent to the buyer confidentially.",
    )
