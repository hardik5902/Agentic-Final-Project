"""
RFQ service — orchestrates the full RFQ creation flow.
Conversation state is persisted in DB; ADK session state is in-memory per request.
"""

import uuid
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.rfq import RFQEvent, RFQConversation
from models.user import User
from models.organization import Organization
from models.invitation import Invitation
from models.response import Response, SupplierQuestion
from models.supplier import Supplier
from schemas.rfq import ApproveRFQRequest
from services import ai_service
from services.cloud_tasks import create_task
from templates.loader import load_template


async def start_rfq(db: Session, user: User, description: str) -> dict:
    org = db.query(Organization).filter(Organization.id == user.org_id).first()

    category = ai_service.identify_category(description)
    template = load_template(category)

    rfq = RFQEvent(
        id=uuid.uuid4(),
        org_id=user.org_id,
        created_by=user.id,
        category=category,
        status="draft",
    )
    db.add(rfq)
    db.flush()

    conversation = RFQConversation(
        id=uuid.uuid4(),
        rfq_id=rfq.id,
        template_used=category,
        fields_remaining=template["required_fields"],
        messages=[{"role": "user", "content": description}],
    )
    db.add(conversation)

    org.monthly_rfq_count = (org.monthly_rfq_count or 0) + 1
    db.commit()
    db.refresh(rfq)

    # First AI question via ADK
    question, _ = await ai_service.process_message(
        rfq_id=str(rfq.id),
        user_id=str(user.id),
        message=description,
        template=template,
        fields_collected={},
    )

    conversation.messages = [
        *(conversation.messages or []),
        {"role": "assistant", "content": question},
    ]
    db.commit()

    return {"rfq_id": rfq.id, "question": question, "status": "collecting"}


async def send_message(db: Session, user: User, rfq_id: uuid.UUID, message: str) -> dict:
    rfq = db.query(RFQEvent).filter(
        RFQEvent.id == rfq_id,
        RFQEvent.org_id == user.org_id,
    ).first()
    if not rfq:
        raise HTTPException(404, "RFQ not found")

    conversation = db.query(RFQConversation).filter(RFQConversation.rfq_id == rfq.id).first()
    if not conversation:
        raise HTTPException(404, "Conversation not found")

    template = load_template(conversation.template_used or "professional_services")
    conversation.messages = [
        *(conversation.messages or []),
        {"role": "user", "content": message},
    ]

    response_text, extracted_fields = await ai_service.process_message(
        rfq_id=str(rfq.id),
        user_id=str(user.id),
        message=message,
        template=template,
        fields_collected=conversation.fields_collected or {},
    )

    conversation.messages = [
        *(conversation.messages or []),
        {"role": "assistant", "content": response_text},
    ]

    required_fields = template.get("required_fields", [])
    progressive_fields = ai_service.extract_required_fields(
        conversation.messages or [],
        required_fields,
    )
    missing_fields = ai_service.get_missing_required_fields(progressive_fields, required_fields)
    conversation.fields_collected = progressive_fields
    conversation.fields_remaining = missing_fields

    if extracted_fields:
        conversation.fields_collected = extracted_fields
        conversation.fields_remaining = ai_service.get_missing_required_fields(
            extracted_fields,
            required_fields,
        )

    completed_fields = conversation.fields_collected or progressive_fields
    remaining_fields = conversation.fields_remaining or missing_fields

    if completed_fields and not remaining_fields:
        conversation.is_complete = True
        rfq.requirements = completed_fields

        org = db.query(Organization).filter(Organization.id == user.org_id).first()
        rfq_doc = await ai_service.generate_rfq_document(
            completed_fields, template, org.name if org else "Your Organisation"
        )
        rfq.rfq_document = rfq_doc
        rfq.title = completed_fields.get("service_type", f"{template['category_name']} RFQ")

        db.commit()

        create_task("generate-pdf", {
            "rfq_id": str(rfq.id),
            "type": "rfq",
            "content": rfq_doc,
        })

        return {
            "status": "complete",
            "question": "Generating the RFQ now. The draft is ready for review on the right.",
            "rfq_document": rfq_doc,
        }

    db.commit()
    return {"status": "collecting", "question": response_text, "rfq_document": None}


def approve_rfq(db: Session, user: User, rfq_id: uuid.UUID, body: ApproveRFQRequest) -> dict:
    rfq = db.query(RFQEvent).filter(
        RFQEvent.id == rfq_id,
        RFQEvent.org_id == user.org_id,
    ).first()
    if not rfq:
        raise HTTPException(404, "RFQ not found")

    deadline = datetime.utcnow() + timedelta(days=body.deadline_days)
    rfq.deadline = deadline
    rfq.criteria = [c.model_dump() for c in body.criteria]
    rfq.status = "active"

    invitations_sent = 0
    for supplier_id in body.supplier_ids:
        supplier = db.query(Supplier).filter(
            Supplier.id == supplier_id,
            Supplier.org_id == user.org_id,
        ).first()
        if not supplier:
            continue

        token = secrets.token_urlsafe(48)[:64]
        invitation = Invitation(
            id=uuid.uuid4(),
            rfq_id=rfq.id,
            supplier_id=supplier.id,
            token=token,
        )
        db.add(invitation)
        db.flush()

        create_task("send-invitation", {
            "invitation_id": str(invitation.id),
            "supplier_email": supplier.email,
            "supplier_name": supplier.name,
            "rfq_title": rfq.title or "RFQ",
            "deadline": deadline.strftime("%Y-%m-%d"),
            "portal_token": token,
            "buyer_company": user.name or "Buyer",
        })
        invitations_sent += 1

    db.commit()
    return {"status": "active", "deadline": deadline, "invitations_sent": invitations_sent, "rfq_id": rfq.id}


def get_rfq(db: Session, user: User, rfq_id: uuid.UUID) -> dict:
    rfq = db.query(RFQEvent).filter(
        RFQEvent.id == rfq_id,
        RFQEvent.org_id == user.org_id,
    ).first()
    if not rfq:
        raise HTTPException(404, "RFQ not found")

    invitations = db.query(Invitation).filter(Invitation.rfq_id == rfq.id).all()
    invitation_list = []
    for inv in invitations:
        supplier = db.query(Supplier).filter(Supplier.id == inv.supplier_id).first()
        invitation_list.append({
            "id": inv.id,
            "supplier_name": supplier.name if supplier else "Unknown",
            "supplier_email": supplier.email if supplier else "",
            "status": inv.status,
        })

    questions = db.query(SupplierQuestion).filter(SupplierQuestion.rfq_id == rfq.id).all()
    question_list = [
        {
            "id": q.id,
            "question": q.question,
            "answer": q.answer,
            "asked_at": q.asked_at,
            "answered_at": q.answered_at,
            "is_shared_with_all": q.is_shared_with_all,
        }
        for q in questions
    ]

    response_count = db.query(Response).filter(Response.rfq_id == rfq.id).count()

    return {
        "id": rfq.id,
        "title": rfq.title,
        "category": rfq.category or "",
        "status": rfq.status,
        "deadline": rfq.deadline,
        "rfq_document": rfq.rfq_document,
        "criteria": rfq.criteria or [],
        "requirements": rfq.requirements or {},
        "invitations": invitation_list,
        "questions": question_list,
        "response_count": response_count,
        "created_at": rfq.created_at,
    }


def list_rfqs(db: Session, user: User, status: str | None, limit: int, offset: int) -> dict:
    q = db.query(RFQEvent).filter(RFQEvent.org_id == user.org_id)
    if status:
        q = q.filter(RFQEvent.status == status)
    total = q.count()
    rfqs = q.order_by(RFQEvent.created_at.desc()).offset(offset).limit(limit).all()
    items = []
    for rfq in rfqs:
        items.append({
            "id": rfq.id,
            "title": rfq.title,
            "category": rfq.category,
            "status": rfq.status,
            "deadline": rfq.deadline,
            "response_count": db.query(Response).filter(Response.rfq_id == rfq.id).count(),
            "invited_count": db.query(Invitation).filter(Invitation.rfq_id == rfq.id).count(),
            "created_at": rfq.created_at,
        })
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def answer_supplier_question(
    db: Session,
    user: User,
    rfq_id: uuid.UUID,
    question_id: uuid.UUID,
    answer: str,
) -> dict:
    rfq = db.query(RFQEvent).filter(
        RFQEvent.id == rfq_id,
        RFQEvent.org_id == user.org_id,
    ).first()
    if not rfq:
        raise HTTPException(404, "RFQ not found")

    question = db.query(SupplierQuestion).filter(
        SupplierQuestion.id == question_id,
        SupplierQuestion.rfq_id == rfq_id,
    ).first()
    if not question:
        raise HTTPException(404, "Question not found")

    cleaned = answer.strip()
    if not cleaned:
        raise HTTPException(400, "Answer cannot be empty")

    question.answer = cleaned
    question.answered_by = user.id
    question.answered_at = datetime.utcnow()
    db.commit()
    db.refresh(question)

    return {
        "question_id": question.id,
        "answer": question.answer,
        "answered_at": question.answered_at,
    }


def close_rfq(db: Session, user: User, rfq_id: uuid.UUID) -> dict:
    rfq = get_rfq(db, user, rfq_id)
    rfq.status = "closed"
    db.commit()
    return {"status": "closed", "rfq_id": rfq_id}


def delete_rfq(db: Session, user: User, rfq_id: uuid.UUID) -> dict:
    rfq = get_rfq(db, user, rfq_id)
    if rfq.status != "draft":
        raise HTTPException(400, "Only draft RFQs can be deleted")
    db.delete(rfq)
    db.commit()
    return {"deleted": True}
