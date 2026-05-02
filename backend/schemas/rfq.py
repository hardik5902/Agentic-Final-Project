from datetime import datetime
from pydantic import BaseModel, UUID4, field_validator


class StartRFQRequest(BaseModel):
    description: str


class StartRFQResponse(BaseModel):
    rfq_id: UUID4
    question: str
    status: str


class MessageRequest(BaseModel):
    message: str


class MessageResponse(BaseModel):
    status: str  # collecting | complete
    question: str | None
    rfq_document: str | None
    contradiction_warning: str | None = None
    category_suggestion: str | None = None


class AnswerQuestionRequest(BaseModel):
    answer: str


class AnswerQuestionResponse(BaseModel):
    question_id: UUID4
    answer: str
    answered_at: datetime


class CriterionWeight(BaseModel):
    name: str
    label: str
    weight: float
    type: str  # calculated | buyer_rated


class ApproveRFQRequest(BaseModel):
    supplier_ids: list[UUID4]
    deadline_days: int
    criteria: list[CriterionWeight]

    @field_validator("criteria")
    @classmethod
    def weights_must_sum_to_one(cls, v: list[CriterionWeight]) -> list[CriterionWeight]:
        total = sum(c.weight for c in v)
        if abs(total - 1.0) > 0.001:
            raise ValueError(f"Criteria weights must sum to 1.0, got {total:.3f}")
        return v


class ApproveRFQResponse(BaseModel):
    status: str
    deadline: datetime
    invitations_sent: int
    rfq_id: UUID4


class InvitationOut(BaseModel):
    id: UUID4
    supplier_id: UUID4
    supplier_name: str | None
    supplier_email: str | None
    status: str
    email_sent_at: datetime | None
    responded_at: datetime | None

    class Config:
        from_attributes = True


class QuestionOut(BaseModel):
    id: UUID4
    question: str
    answer: str | None
    asked_at: datetime
    answered_at: datetime | None
    is_shared_with_all: bool

    class Config:
        from_attributes = True


class RFQDetailOut(BaseModel):
    id: UUID4
    title: str | None
    category: str | None
    status: str
    deadline: datetime | None
    requirements: dict
    criteria: list
    rfq_document: str | None
    rfq_document_pdf_url: str | None
    invitations: list[InvitationOut] = []
    response_count: int = 0
    questions: list[QuestionOut] = []

    class Config:
        from_attributes = True


class RFQListItem(BaseModel):
    id: UUID4
    title: str | None
    category: str | None
    status: str
    deadline: datetime | None
    response_count: int
    invited_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class RFQListResponse(BaseModel):
    items: list[RFQListItem]
    total: int
    limit: int
    offset: int
