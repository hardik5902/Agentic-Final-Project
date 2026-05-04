# QuoteFlow - 08: API Reference

> Load this file when: building API endpoints, writing frontend API calls, testing with Postman, or checking endpoint contracts

---

## Base URLs

```text
Development: http://localhost:8080
Production:  https://quoteflow-api-{hash}.run.app
```

---

## Authentication

- Buyer endpoints use JWT bearer auth.
- Supplier portal endpoints use URL-token auth.
- Internal task endpoints use Cloud Tasks OIDC auth.

Standard error shape:

```json
{
  "detail": "Human-readable error message"
}
```

---

## Supplier Portal Endpoints

These endpoints are public but token-protected and rate-limited.

### GET /api/response/{token}/portal

Load the supplier inbox tied to the supplier behind the invitation token.

Response:

```json
{
  "supplier_name": "Studio A Productions",
  "supplier_email": "hello@studioa.com",
  "invitations": [
    {
      "invitation_token": "64-char-token",
      "rfq_id": "uuid",
      "rfq_title": "Video Production RFQ",
      "buyer_company": "Acme Manufacturing",
      "category": "marketing_agencies",
      "deadline": "2026-05-12T09:00:00Z",
      "rfq_status": "active",
      "invitation_status": "responded",
      "already_submitted": true,
      "is_closed": false,
      "can_open": true,
      "can_edit": true,
      "responded_at": "2026-05-01T13:12:00Z",
      "updated_at": "2026-05-01T13:12:00Z",
      "created_at": "2026-04-28T09:00:00Z"
    }
  ]
}
```

Notes:

- Marks the invitation as viewed on first access.
- Returns all invitations for that supplier, not just the one invite used to enter.

### GET /api/response/{token}

Load a single RFQ response view.

Response:

```json
{
  "rfq": {
    "title": "Video Production RFQ",
    "rfq_document": "REQUEST FOR QUOTATION...",
    "deadline": "2026-05-12T09:00:00Z",
    "buyer_company": "Acme Manufacturing",
    "requirements": {}
  },
  "form_fields": [
    {
      "field_id": "total_price",
      "label": "Total Project Price (USD)",
      "type": "number",
      "required": true,
      "hint": "All-in price for the full scope"
    }
  ],
  "answered_questions": [],
  "already_submitted": true,
  "rfq_status": "active",
  "submitted_data": {
    "total_price": 16500,
    "currency": "USD"
  }
}
```

Notes:

- Returns prefilled `submitted_data` when the supplier already responded.
- Blocks new access for non-submitted suppliers after close/deadline.

### POST /api/response/{token}

Create the first submitted response for an invitation.

Request:

```json
{
  "data": {
    "proposed_approach": "We would approach this project...",
    "total_price": 16500,
    "currency": "USD"
  },
  "attachment_gcs_paths": [
    "supplier-responses/uuid/certificate.pdf"
  ]
}
```

Response:

```json
{
  "status": "submitted",
  "message": "Thank you — your response has been submitted."
}
```

### PUT /api/response/{token}

Update an already-submitted response while the RFQ remains open.

Request body: same shape as `POST /api/response/{token}`.

Response:

```json
{
  "status": "updated",
  "message": "Your response has been updated successfully."
}
```

### POST /api/response/{token}/question

Send a supplier clarification question.

Request:

```json
{
  "question": "Can you confirm whether licensing is included?"
}
```

Response:

```json
{
  "question_id": "uuid",
  "status": "submitted",
  "message": "Your question has been sent to the buyer. The answer will be shared with all invited suppliers."
}
```

---

## Analysis Endpoints

### POST /api/analysis/{rfq_id}/normalize

Normalize all submitted responses.

### GET /api/analysis/{rfq_id}/results

Return qualifying suppliers, eliminated suppliers, and criteria.

### POST /api/analysis/{rfq_id}/score

Calculate scores for qualifying suppliers.

### POST /api/analysis/{rfq_id}/evaluate

Generate AI response analyses.

Response:

```json
{
  "evaluations": [
    {
      "supplier_name": "Studio A",
      "ambiguous_fields": [
        "Timeline is described loosely rather than committed explicitly"
      ],
      "missing_evidence": [
        "No reference contact details were provided"
      ],
      "clarification_questions": [
        "Can you confirm the exact delivery timeline in weeks?"
      ],
      "compliance_failures": [],
      "strategic_concerns": [
        "Approach is high level and missing milestone detail"
      ],
      "evaluation_summary": "Strong fit overall, but some details need clarification."
    }
  ]
}
```

### POST /api/analysis/{rfq_id}/memo

Generate the sourcing decision memo.

Response:

```json
{
  "memo_text": "# Sourcing Decision Memo: Video Production RFQ\n\n## Recommendation\n**PREFERRED SUPPLIER** ...",
  "memo_pdf_signed_url": null
}
```

### GET /api/analysis/{rfq_id}/memo

Fetch the latest memo text and signed PDF URL when ready.

---

## Internal Tasks

The repo also exposes internal Cloud Tasks endpoints for:

- sending invitations
- generating PDFs
- sending reminders
- notifying buyers of responses
- recalculating supplier stats

These are not public endpoints.

---

*See 00-INDEX.md for the full file map*
