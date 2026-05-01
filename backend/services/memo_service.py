"""
memo_service — orchestrates decision memo generation and PDF upload.
AI call goes through ai_service; PDF upload goes through storage_service.
Slow PDF work is dispatched as a Cloud Task.
"""

import logging
from sqlalchemy.orm import Session

from models.rfq import RFQEvent
from models.response import Response
from models.supplier import Supplier
from services import ai_service, storage_service
from services.cloud_tasks import create_task

logger = logging.getLogger(__name__)


async def generate_memo(db: Session, rfq: RFQEvent) -> str:
    """Generate memo text via AI, queue PDF as Cloud Task, save memo_text to DB."""
    responses = (
        db.query(Response)
        .filter(Response.rfq_id == rfq.id)
        .all()
    )

    qualifying = []
    eliminated = []
    for resp in responses:
        supplier = db.query(Supplier).filter(Supplier.id == resp.supplier_id).first()
        name = supplier.name if supplier else "Unknown"
        if resp.eliminated:
            eliminated.append({
                "supplier_name": name,
                "elimination_reason": resp.elimination_reason or "Eliminated",
            })
        else:
            qualifying.append({
                "supplier_name": name,
                "score": resp.score,
                "score_breakdown": resp.score_breakdown,
                "normalized_data": resp.normalized_data,
            })

    qualifying_sorted = sorted(qualifying, key=lambda x: x.get("score") or 0, reverse=True)

    memo_text = await ai_service.generate_decision_memo(
        rfq_title=rfq.title or "RFQ",
        scores=qualifying_sorted,
        eliminated=eliminated,
        criteria=rfq.criteria or [],
    )

    rfq.memo_text = memo_text
    db.commit()

    # Queue PDF generation as Cloud Task (async — does not block response)
    create_task("generate-pdf", {
        "rfq_id": str(rfq.id),
        "type": "memo",
        "content": memo_text,
    })

    return memo_text
