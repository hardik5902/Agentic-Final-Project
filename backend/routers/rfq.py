import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas.rfq import (
    StartRFQRequest, StartRFQResponse,
    MessageRequest, MessageResponse,
    ApproveRFQRequest, ApproveRFQResponse,
    AnswerQuestionRequest, AnswerQuestionResponse,
    RFQDetailOut, RFQListResponse,
)
from services import rfq_service
from services.auth_service import get_current_user

router = APIRouter()


@router.post("/start", response_model=StartRFQResponse)
async def start_rfq(
    body: StartRFQRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return await rfq_service.start_rfq(db, user, body.description)


@router.post("/{rfq_id}/message", response_model=MessageResponse)
async def send_message(
    rfq_id: uuid.UUID,
    body: MessageRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return await rfq_service.send_message(db, user, rfq_id, body.message)


@router.post("/{rfq_id}/approve", response_model=ApproveRFQResponse)
def approve_rfq(
    rfq_id: uuid.UUID,
    body: ApproveRFQRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return rfq_service.approve_rfq(db, user, rfq_id, body)


@router.post("/{rfq_id}/questions/{question_id}/answer", response_model=AnswerQuestionResponse)
def answer_question(
    rfq_id: uuid.UUID,
    question_id: uuid.UUID,
    body: AnswerQuestionRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return rfq_service.answer_supplier_question(db, user, rfq_id, question_id, body.answer)


@router.get("/list", response_model=RFQListResponse)
def list_rfqs(
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return rfq_service.list_rfqs(db, user, status, limit, offset)


@router.get("/{rfq_id}")
def get_rfq(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return rfq_service.get_rfq(db, user, rfq_id)


@router.put("/{rfq_id}/close")
def close_rfq(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return rfq_service.close_rfq(db, user, rfq_id)


@router.delete("/{rfq_id}")
def delete_rfq(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return rfq_service.delete_rfq(db, user, rfq_id)
