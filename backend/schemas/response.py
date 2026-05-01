from datetime import datetime
from pydantic import BaseModel, UUID4


class SupplierResponseForm(BaseModel):
    """Dynamic — fields vary by category template. Raw dict accepted."""
    model_config = {"extra": "allow"}


class SubmitResponseRequest(BaseModel):
    data: dict  # template-defined fields
    attachment_gcs_paths: list[str] = []


class SubmitResponseResult(BaseModel):
    status: str
    message: str


class QuestionRequest(BaseModel):
    question: str


class QuestionResult(BaseModel):
    question_id: UUID4
    status: str
    message: str


class FormFieldOut(BaseModel):
    field_id: str
    label: str
    type: str
    required: bool
    hint: str | None = None
    options: list[str] | None = None
    min_count: int | None = None
    max_words: int | None = None


class AnsweredQuestionOut(BaseModel):
    question: str
    answer: str | None
    answered_at: datetime | None


class SupplierPortalRFQ(BaseModel):
    title: str | None
    rfq_document: str | None
    deadline: datetime | None
    buyer_company: str | None
    requirements: dict


class SupplierPortalResponse(BaseModel):
    rfq: SupplierPortalRFQ
    form_fields: list[FormFieldOut]
    answered_questions: list[AnsweredQuestionOut]


class NormalizeResult(BaseModel):
    normalized_count: int
    eliminated_count: int
    eliminated: list[dict]


class RatingSubmission(BaseModel):
    ratings: dict[str, dict[str, int]]  # {response_id: {criterion_name: 1-5}}


class ScoreOut(BaseModel):
    supplier_name: str
    response_id: UUID4
    score: float
    score_breakdown: dict


class ScoreResponse(BaseModel):
    scores: list[ScoreOut]


class MemoResponse(BaseModel):
    memo_text: str
    memo_pdf_signed_url: str | None = None
