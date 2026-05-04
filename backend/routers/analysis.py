import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.rfq import RFQEvent
from models.response import Response
from models.supplier import Supplier
from models.invitation import Invitation
from schemas.response import NormalizeResult, RatingSubmission, ScoreResponse, MemoResponse
from services import normalization_service, scoring_service, memo_service, storage_service, ai_service
from services.auth_service import get_current_user
from templates.loader import load_template

router = APIRouter()


def _get_rfq(db: Session, rfq_id: uuid.UUID, user) -> RFQEvent:
    rfq = db.query(RFQEvent).filter(
        RFQEvent.id == rfq_id,
        RFQEvent.org_id == user.org_id,
    ).first()
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    return rfq


@router.post("/{rfq_id}/normalize", response_model=NormalizeResult)
def normalize_responses(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rfq = _get_rfq(db, rfq_id, user)
    template = load_template(rfq.category or "professional_services")
    responses = db.query(Response).filter(Response.rfq_id == rfq.id).all()

    eliminated_list = []
    for resp in responses:
        nd, flags = normalization_service.normalize(resp.raw_data, rfq.requirements or {}, template)
        resp.normalized_data = nd
        resp.flags = flags
        hard_flags = [f for f in flags if f.get("eliminates")]
        if hard_flags:
            resp.eliminated = True
            resp.elimination_reason = hard_flags[0]["message"]
            supplier = db.query(Supplier).filter(Supplier.id == resp.supplier_id).first()
            eliminated_list.append({
                "supplier_name": supplier.name if supplier else "Unknown",
                "reason": resp.elimination_reason,
            })

    db.commit()
    return NormalizeResult(
        normalized_count=len(responses),
        eliminated_count=len(eliminated_list),
        eliminated=eliminated_list,
    )


@router.get("/{rfq_id}/results")
def get_results(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rfq = _get_rfq(db, rfq_id, user)
    responses = db.query(Response).filter(Response.rfq_id == rfq.id).all()

    qualifying = []
    eliminated = []
    for resp in responses:
        supplier = db.query(Supplier).filter(Supplier.id == resp.supplier_id).first()
        name = supplier.name if supplier else "Unknown"
        if resp.eliminated:
            eliminated.append({"supplier_name": name, "elimination_reason": resp.elimination_reason})
        else:
            qualifying.append({
                "supplier_name": name,
                "supplier_id": str(resp.supplier_id),
                "response_id": str(resp.id),
                "normalized_data": resp.normalized_data,
                "flags": resp.flags,
                "score": resp.score,
                "buyer_ratings": resp.buyer_ratings,
            })

    return {"qualifying": qualifying, "eliminated": eliminated, "criteria": rfq.criteria}


@router.get("/{rfq_id}/responses/{response_id}")
def get_response_detail(
    rfq_id: uuid.UUID,
    response_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _get_rfq(db, rfq_id, user)
    resp = db.query(Response).filter(
        Response.id == response_id,
        Response.rfq_id == rfq_id,
    ).first()
    if not resp:
        raise HTTPException(404, "Response not found")

    supplier = db.query(Supplier).filter(Supplier.id == resp.supplier_id).first()
    return {
        "response_id": str(resp.id),
        "supplier_name": supplier.name if supplier else "Unknown",
        "raw_data": resp.raw_data or {},
        "normalized_data": resp.normalized_data or {},
        "attachment_urls": resp.attachment_urls or [],
        "score": resp.score,
        "score_breakdown": resp.score_breakdown or {},
        "flags": resp.flags or [],
    }


@router.post("/{rfq_id}/rate")
def submit_ratings(
    rfq_id: uuid.UUID,
    body: RatingSubmission,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _get_rfq(db, rfq_id, user)
    for response_id, ratings in body.ratings.items():
        resp = db.query(Response).filter(Response.id == response_id).first()
        if resp:
            resp.buyer_ratings = ratings
    db.commit()
    return {"status": "ratings_saved"}


@router.post("/{rfq_id}/score", response_model=ScoreResponse)
def score_responses(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rfq = _get_rfq(db, rfq_id, user)
    template = load_template(rfq.category or "professional_services")
    responses = db.query(Response).filter(Response.rfq_id == rfq.id).all()

    # Auto-normalize any response that hasn't been normalized yet (or was cleared after an update)
    for resp in responses:
        if resp.normalized_data is None:
            nd, flags = normalization_service.normalize(resp.raw_data, rfq.requirements or {}, template)
            resp.normalized_data = nd
            resp.flags = flags
            hard_flags = [f for f in flags if f.get("eliminates")]
            if hard_flags:
                resp.eliminated = True
                resp.elimination_reason = hard_flags[0]["message"]
    db.commit()

    resp_dicts = []
    buyer_ratings = {}
    for resp in responses:
        supplier = db.query(Supplier).filter(Supplier.id == resp.supplier_id).first()
        d = {
            "id": resp.id,
            "supplier_name": supplier.name if supplier else "Unknown",
            "normalized_data": resp.normalized_data or {},
            "eliminated": resp.eliminated,
        }
        resp_dicts.append(d)
        if resp.buyer_ratings:
            buyer_ratings[str(resp.id)] = resp.buyer_ratings

    # Use template criteria (calculated only) if stored criteria still contain buyer_rated entries
    stored_criteria = rfq.criteria or []
    effective_criteria = [c for c in stored_criteria if c.get("type") == "calculated"]
    if not effective_criteria:
        effective_criteria = [c for c in template.get("default_evaluation_criteria", []) if c.get("type") == "calculated"]
    scored = scoring_service.score_suppliers(resp_dicts, effective_criteria, buyer_ratings)

    for scored_resp in scored:
        db_resp = db.query(Response).filter(Response.id == scored_resp["id"]).first()
        if db_resp:
            db_resp.score = scored_resp["score"]
            db_resp.score_breakdown = scored_resp["score_breakdown"]
    db.commit()

    return ScoreResponse(scores=[
        {"supplier_name": r["supplier_name"], "response_id": r["id"],
         "score": r["score"], "score_breakdown": r["score_breakdown"]}
        for r in scored
    ])


@router.post("/{rfq_id}/memo", response_model=MemoResponse)
async def generate_memo(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rfq = _get_rfq(db, rfq_id, user)
    memo_text = await memo_service.generate_memo(db, rfq)
    return MemoResponse(memo_text=memo_text, memo_pdf_signed_url=None)


@router.post("/{rfq_id}/evaluate")
def evaluate_responses(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Response evaluation agent — identifies ambiguities, missing evidence,
    clarification questions, compliance failures, and strategic concerns
    for each submitted supplier response.
    """
    rfq = _get_rfq(db, rfq_id, user)
    responses = db.query(Response).filter(Response.rfq_id == rfq.id).all()

    if not responses:
        return {"evaluations": []}

    response_dicts = []
    for resp in responses:
        supplier = db.query(Supplier).filter(Supplier.id == resp.supplier_id).first()
        response_dicts.append({
            "supplier_name": supplier.name if supplier else "Unknown",
            "raw_data": resp.raw_data or {},
            "normalized_data": resp.normalized_data or {},
            "flags": resp.flags or [],
        })

    evaluations = ai_service.evaluate_responses(
        responses=response_dicts,
        rfq_requirements=rfq.requirements or {},
        rfq_title=rfq.title or "RFQ",
    )
    return {"evaluations": evaluations}


@router.get("/{rfq_id}/memo", response_model=MemoResponse)
def get_memo(
    rfq_id: uuid.UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rfq = _get_rfq(db, rfq_id, user)
    if not rfq.memo_text:
        raise HTTPException(404, "Memo not yet generated")

    signed_url = None
    if rfq.memo_pdf_url:
        try:
            signed_url = storage_service.get_signed_url(rfq.memo_pdf_url)
        except Exception:
            pass

    return MemoResponse(memo_text=rfq.memo_text, memo_pdf_signed_url=signed_url)
