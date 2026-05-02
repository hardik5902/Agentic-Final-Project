"""
RFQ service — orchestrates the full RFQ creation flow.
Conversation state is persisted in DB; ADK session state is in-memory per request.
"""

import logging
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

logger = logging.getLogger(__name__)


async def start_rfq(db: Session, user: User, description: str) -> dict:
    logger.info("start_rfq user=%s org=%s description_len=%d", user.id, user.org_id, len(description))
    org = db.query(Organization).filter(Organization.id == user.org_id).first()

    category = ai_service.identify_category(description)
    logger.info("start_rfq rfq category identified as %s", category)
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
    logger.info("start_rfq created rfq=%s", rfq.id)

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

    logger.info("start_rfq calling process_message rfq=%s", rfq.id)
    question, _, _, _ = await ai_service.process_message(
        rfq_id=str(rfq.id),
        user_id=str(user.id),
        message=description,
        template=template,
        fields_collected={},
    )
    logger.info("start_rfq returned question len=%d rfq=%s", len(question), rfq.id)

    conversation.messages = [
        *(conversation.messages or []),
        {"role": "assistant", "content": question},
    ]
    db.commit()

    return {"rfq_id": rfq.id, "question": question, "status": "collecting"}


async def send_message(db: Session, user: User, rfq_id: uuid.UUID, message: str) -> dict:
    logger.info("send_message rfq=%s user=%s message_len=%d", rfq_id, user.id, len(message))
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
    required_fields = template.get("required_fields", [])

    conversation.messages = [
        *(conversation.messages or []),
        {"role": "user", "content": message},
    ]

    # Single model call returns assistant reply, updated fields, contradiction warning, category suggestion
    response_text, extracted_fields, contradiction, category_suggestion = await ai_service.process_message(
        rfq_id=str(rfq.id),
        user_id=str(user.id),
        message=message,
        template=template,
        fields_collected=conversation.fields_collected or {},
    )
    logger.info(
        "send_message response len=%d extracted_fields=%s contradiction=%s category_suggestion=%s rfq=%s",
        len(response_text), bool(extracted_fields), bool(contradiction), category_suggestion, rfq_id,
    )

    # Prepend contradiction warning so it appears inline in the conversation
    if contradiction:
        response_text = f"⚠️ Potential inconsistency detected: {contradiction}\n\n{response_text}"

    # If the agent detected a better category and template has more required fields, offer the switch
    if category_suggestion and category_suggestion != (conversation.template_used or "professional_services"):
        from templates.loader import load_template as _load_template
        suggested_template = _load_template(category_suggestion)
        response_text = (
            f"{response_text}\n\n💡 Based on your description, this might better fit the "
            f"**{suggested_template.get('category_name', category_suggestion)}** category. "
            f"Reply 'switch to {category_suggestion}' if you'd like to use that template."
        )

    conversation.messages = [
        *(conversation.messages or []),
        {"role": "assistant", "content": response_text},
    ]

    if extracted_fields:
        # Merge new values on top of previously collected fields
        merged = {**(conversation.fields_collected or {}), **extracted_fields}
        conversation.fields_collected = merged
        conversation.fields_remaining = ai_service.get_missing_required_fields(merged, required_fields)
        logger.info("send_message fields merged rfq=%s collected=%d missing=%d", rfq_id, len(merged), len(conversation.fields_remaining))

    completed_fields = conversation.fields_collected or {}
    remaining_fields = conversation.fields_remaining if conversation.fields_remaining is not None else required_fields

    if completed_fields and not remaining_fields:
        logger.info("send_message all fields collected — building deterministic RFQ rfq=%s", rfq_id)
        conversation.is_complete = True
        rfq.requirements = completed_fields

        org = db.query(Organization).filter(Organization.id == user.org_id).first()
        org_name = org.name if org else "Your Organisation"

        # Return the deterministic draft immediately — no model wait
        rfq_doc = ai_service.build_rfq_document(completed_fields, template, org_name)
        rfq.rfq_document = rfq_doc
        rfq.title = completed_fields.get("service_type", f"{template['category_name']} RFQ")
        db.commit()

        # AI polish happens in background — updates rfq_document when done
        create_task("polish-rfq", {
            "rfq_id": str(rfq.id),
            "org_name": org_name,
        })
        create_task("generate-pdf", {
            "rfq_id": str(rfq.id),
            "type": "rfq",
            "content": rfq_doc,
        })

        return {
            "status": "complete",
            "question": "Your RFQ draft is ready for review.",
            "rfq_document": rfq_doc,
            "contradiction_warning": None,
            "category_suggestion": None,
        }

    db.commit()
    logger.info("send_message still collecting rfq=%s remaining_fields=%s", rfq_id, remaining_fields)
    return {
        "status": "collecting",
        "question": response_text,
        "rfq_document": None,
        "contradiction_warning": contradiction,
        "category_suggestion": category_suggestion,
    }


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


def suggest_suppliers(db: Session, user: User, rfq_id: uuid.UUID) -> list[dict]:
    """
    Supplier sourcing agent — ranks all active org suppliers by fit for this RFQ.
    Returns a ranked list with fit_score, fit_reasoning, batch, and recommended flag.
    """
    rfq = db.query(RFQEvent).filter(
        RFQEvent.id == rfq_id,
        RFQEvent.org_id == user.org_id,
    ).first()
    if not rfq:
        raise HTTPException(404, "RFQ not found")

    suppliers = db.query(Supplier).filter(
        Supplier.org_id == user.org_id,
        Supplier.is_active == True,
    ).all()

    if not suppliers:
        return []

    supplier_dicts = [
        {
            "supplier_id": str(s.id),
            "name": s.name,
            "categories": s.categories or [],
            "response_rate": round((s.response_rate or 0) * 100, 1),
            "total_invitations": s.total_invitations or 0,
            "total_responses": s.total_responses or 0,
            "avg_response_days": s.avg_response_days,
        }
        for s in suppliers
    ]

    logger.info("suggest_suppliers rfq=%s supplier_count=%d", rfq_id, len(supplier_dicts))
    return ai_service.rank_suppliers(
        rfq_requirements=rfq.requirements or {},
        rfq_category=rfq.category or "professional_services",
        suppliers=supplier_dicts,
    )
