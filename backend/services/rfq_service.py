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

    conversation.messages.append({"role": "assistant", "content": question})
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
    conversation.messages.append({"role": "user", "content": message})

    response_text, extracted_fields = await ai_service.process_message(
        rfq_id=str(rfq.id),
        user_id=str(user.id),
        message=message,
        template=template,
        fields_collected=conversation.fields_collected or {},
    )

    conversation.messages.append({"role": "assistant", "content": response_text})

    if extracted_fields:
        # ADK agent called extract_fields tool — conversation complete
        conversation.fields_collected = extracted_fields
        conversation.is_complete = True
        rfq.requirements = extracted_fields

        org = db.query(Organization).filter(Organization.id == user.org_id).first()
        rfq_doc = await ai_service.generate_rfq_document(
            extracted_fields, template, org.name if org else "Your Organisation"
        )
        rfq.rfq_document = rfq_doc
        rfq.title = extracted_fields.get("service_type", f"{template['category_name']} RFQ")

        db.commit()

        create_task("generate-pdf", {
            "rfq_id": str(rfq.id),
            "type": "rfq",
            "content": rfq_doc,
        })

        return {"status": "complete", "question": None, "rfq_document": rfq_doc}

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


def get_rfq(db: Session, user: User, rfq_id: uuid.UUID) -> RFQEvent:
    rfq = db.query(RFQEvent).filter(
        RFQEvent.id == rfq_id,
        RFQEvent.org_id == user.org_id,
    ).first()
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    return rfq


def list_rfqs(db: Session, user: User, status: str | None, limit: int, offset: int) -> dict:
    q = db.query(RFQEvent).filter(RFQEvent.org_id == user.org_id)
    if status:
        q = q.filter(RFQEvent.status == status)
    total = q.count()
    items = q.order_by(RFQEvent.created_at.desc()).offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


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
