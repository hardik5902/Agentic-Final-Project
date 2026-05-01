# QuoteFlow — 08: API Reference

> Load this file when: building API endpoints, writing frontend API calls, testing with Postman, or checking endpoint contracts

---

## Base URLs

```
Development:   http://localhost:8080
Production:    https://quoteflow-api-{hash}.run.app
```

## Authentication

Most endpoints require a JWT bearer token:
```
Authorization: Bearer {jwt_token}
```

Supplier portal endpoints use a URL token — no Authorization header.

Internal task endpoints use a Cloud Tasks OIDC token — not accessible from public internet.

## Standard Error Response

```json
{
  "detail": "Human-readable error message"
}
```

Status codes: 200 success, 201 created, 400 bad request, 401 unauthorized, 403 forbidden, 404 not found, 422 validation error, 500 server error.

---

## Authentication Endpoints

### POST /api/auth/register
Create a new user account and organization.

Auth: None

Request body:
```json
{
  "email": "sarah@company.com",
  "password": "minimum 8 characters",
  "name": "Sarah Johnson",
  "org_name": "Acme Manufacturing"
}
```

Response 201:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "sarah@company.com",
    "name": "Sarah Johnson",
    "role": "owner"
  }
}
```

Errors: 400 if email already registered.

---

### POST /api/auth/login
Get a JWT token for an existing account.

Auth: None

Request body (form data, OAuth2 standard):
```
username=sarah@company.com
password=yourpassword
```

Response 200:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

Errors: 401 if credentials incorrect.

---

### GET /api/auth/me
Get current authenticated user's details.

Auth: JWT

Response 200:
```json
{
  "id": "uuid",
  "email": "sarah@company.com",
  "name": "Sarah Johnson",
  "role": "owner",
  "org_id": "uuid",
  "org_name": "Acme Manufacturing",
  "subscription_tier": "starter"
}
```

---

### PUT /api/auth/me
Update current user's profile.

Auth: JWT

Request body (all fields optional):
```json
{
  "name": "Sarah Johnson",
  "email": "newemail@company.com"
}
```

Response 200: Updated user object (same shape as GET /api/auth/me)

---

## RFQ Management Endpoints

### POST /api/rfq/start
Begin a new RFQ with an initial description. Starts the AI conversation.

Auth: JWT

Request body:
```json
{
  "description": "I need to source video production services for a brand film"
}
```

Response 200:
```json
{
  "rfq_id": "uuid",
  "question": "What is the approximate budget range for this project?",
  "status": "collecting"
}
```

Errors: 403 if free tier monthly limit reached.

---

### POST /api/rfq/{rfq_id}/message
Send a message in the RFQ creation conversation.

Auth: JWT

URL params: `rfq_id` — UUID of the RFQ event

Request body:
```json
{
  "message": "Budget is between $12,000 and $18,000"
}
```

Response 200 (still collecting):
```json
{
  "status": "collecting",
  "question": "How many weeks do you need for delivery?",
  "rfq_document": null
}
```

Response 200 (complete):
```json
{
  "status": "complete",
  "question": null,
  "rfq_document": "REQUEST FOR QUOTATION\n\nIssued by: Acme Manufacturing..."
}
```

Errors: 404 if RFQ not found or belongs to different org.

---

### GET /api/rfq/{rfq_id}/preview
Get the generated RFQ document text.

Auth: JWT

Response 200:
```json
{
  "rfq_id": "uuid",
  "title": "Video Production RFQ",
  "category": "marketing_agencies",
  "rfq_document": "REQUEST FOR QUOTATION\n\n...",
  "rfq_document_pdf_url": null,
  "requirements": {
    "service_type": "video production",
    "budget_min": 12000,
    "budget_max": 18000,
    "timeline_weeks": 4
  }
}
```

---

### POST /api/rfq/{rfq_id}/approve
Lock the RFQ and send invitations to selected suppliers.

Auth: JWT

Request body:
```json
{
  "supplier_ids": ["uuid1", "uuid2", "uuid3"],
  "deadline_days": 14,
  "criteria": [
    {"name": "proposed_approach", "label": "Approach Quality", "weight": 0.30, "type": "buyer_rated"},
    {"name": "price", "label": "Total Price", "weight": 0.25, "type": "calculated"},
    {"name": "portfolio", "label": "Portfolio", "weight": 0.25, "type": "buyer_rated"},
    {"name": "timeline", "label": "Timeline", "weight": 0.10, "type": "calculated"},
    {"name": "team_experience", "label": "Team", "weight": 0.10, "type": "buyer_rated"}
  ]
}
```

Validation: criteria weights must sum to 1.0 (100%). All supplier_ids must belong to current org.

Response 200:
```json
{
  "status": "active",
  "deadline": "2026-05-12T09:00:00Z",
  "invitations_sent": 3,
  "rfq_id": "uuid"
}
```

Side effects: Creates invitation records, triggers Cloud Tasks to send invitation emails.

---

### GET /api/rfq/{rfq_id}
Get full RFQ details including invitation statuses.

Auth: JWT

Response 200:
```json
{
  "id": "uuid",
  "title": "Video Production RFQ",
  "category": "marketing_agencies",
  "status": "active",
  "deadline": "2026-05-12T09:00:00Z",
  "requirements": {...},
  "criteria": [...],
  "rfq_document": "...",
  "rfq_document_pdf_url": "/api/files/rfq-documents/uuid/rfq.pdf",
  "invitations": [
    {
      "id": "uuid",
      "supplier_id": "uuid",
      "supplier_name": "Studio A",
      "supplier_email": "hello@studioa.com",
      "status": "responded",
      "email_sent_at": "2026-04-28T10:00:00Z",
      "responded_at": "2026-04-30T14:22:00Z"
    }
  ],
  "response_count": 1,
  "questions": [
    {
      "id": "uuid",
      "question": "Does the budget include music licensing?",
      "answer": "Yes, original music licensing is included in the budget.",
      "asked_at": "2026-04-29T11:00:00Z",
      "answered_at": "2026-04-29T15:00:00Z",
      "is_shared_with_all": true
    }
  ]
}
```

---

### GET /api/rfq/list
Get all RFQ events for the current organization.

Auth: JWT

Query params: `status` (optional, filter by status), `limit` (default 20), `offset` (default 0)

Response 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Video Production RFQ",
      "category": "marketing_agencies",
      "status": "active",
      "deadline": "2026-05-12T09:00:00Z",
      "response_count": 1,
      "invited_count": 3,
      "created_at": "2026-04-28T09:00:00Z"
    }
  ],
  "total": 12,
  "limit": 20,
  "offset": 0
}
```

---

### PUT /api/rfq/{rfq_id}/close
Close an active RFQ event.

Auth: JWT

Response 200:
```json
{"status": "closed", "rfq_id": "uuid"}
```

---

### DELETE /api/rfq/{rfq_id}
Cancel and delete a draft RFQ. Only works on draft status.

Auth: JWT

Response 200:
```json
{"deleted": true}
```

Errors: 400 if RFQ is not in draft status.

---

## Supplier Management Endpoints

### GET /api/suppliers
List all supplier contacts for the current organization.

Auth: JWT

Query params: `category` (optional filter), `search` (optional name/email search)

Response 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Studio A Productions",
      "email": "hello@studioa.com",
      "categories": ["marketing_agencies", "professional_services"],
      "response_rate": 0.85,
      "total_invitations": 7,
      "total_responses": 6,
      "last_responded_at": "2026-04-15T00:00:00Z"
    }
  ],
  "total": 24
}
```

---

### POST /api/suppliers
Add a new supplier contact.

Auth: JWT

Request body:
```json
{
  "name": "Studio A Productions",
  "email": "hello@studioa.com",
  "website": "https://studioa.com",
  "country": "US",
  "categories": ["marketing_agencies"],
  "notes": "Good for fintech brand videos"
}
```

Response 201: Created supplier object.

Errors: 400 if email already exists for this organization.

---

### PUT /api/suppliers/{supplier_id}
Update a supplier's details.

Auth: JWT

Request body: Same as POST, all fields optional.

Response 200: Updated supplier object.

---

### DELETE /api/suppliers/{supplier_id}
Remove a supplier from the organization's list.

Auth: JWT

Response 200:
```json
{"deleted": true}
```

---

### POST /api/suppliers/import
Bulk import suppliers from a CSV file.

Auth: JWT

Request: multipart/form-data with CSV file.

CSV format:
```
name,email,website,country,categories
Studio A,hello@studioa.com,https://studioa.com,US,"marketing_agencies"
```

Response 200:
```json
{
  "imported": 12,
  "skipped": 2,
  "errors": ["Row 5: invalid email format"]
}
```

---

### GET /api/suppliers/discover
Get vendor directory suggestions for a category.

Auth: JWT

Query params: `category` (required), `subcategory` (optional), `country` (optional), `limit` (default 10)

Response 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Huge Inc",
      "email": "newbusiness@hugeinc.com",
      "website": "https://hugeinc.com",
      "country": "US",
      "categories": ["marketing_agencies"],
      "description": "Global experience design agency",
      "clutch_rating": 4.8,
      "verified": true
    }
  ]
}
```

---

## Supplier Portal Endpoints

These endpoints use URL token auth — no JWT. Publicly accessible (rate limited).

### GET /api/response/{token}
Get RFQ details and form structure for the supplier.

Auth: URL token

Response 200:
```json
{
  "rfq": {
    "title": "Video Production RFQ",
    "rfq_document": "REQUEST FOR QUOTATION...",
    "deadline": "2026-05-12T09:00:00Z",
    "buyer_company": "Acme Manufacturing",
    "requirements": {...}
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
  "answered_questions": [
    {
      "question": "Does the budget include music licensing?",
      "answer": "Yes, original music licensing is included.",
      "answered_at": "2026-04-29T15:00:00Z"
    }
  ]
}
```

Errors: 404 if token invalid, 400 if deadline passed or already submitted.

Side effect: Sets invitation status to "viewed" on first access.

---

### POST /api/response/{token}
Submit the supplier's response.

Auth: URL token

Request body: Dynamic — matches the `response_form_fields` from the template.

Example for marketing agencies:
```json
{
  "proposed_approach": "We would approach this project...",
  "total_price": 16500,
  "currency": "USD",
  "timeline_value": 3.5,
  "timeline_unit": "weeks",
  "revision_rounds_included": 2,
  "additional_revision_cost": 800,
  "team_lead_name": "Alex Chen",
  "payment_terms": "50/50 (50% upfront, 50% on delivery)",
  "portfolio_links": ["https://studio.com/work1", "https://studio.com/work2"],
  "attachment_gcs_paths": ["supplier-responses/uuid/certificate.pdf"]
}
```

Response 200:
```json
{
  "status": "submitted",
  "message": "Thank you — your response has been submitted."
}
```

Errors: 400 if required fields missing, 400 if already submitted.

Side effects: Sets invitation status to "responded", triggers notify-buyer Cloud Task, triggers update-supplier-stats Cloud Task.

---

### POST /api/response/{token}/question
Supplier submits a clarification question.

Auth: URL token

Request body:
```json
{
  "question": "Does the budget include music licensing fees?"
}
```

Response 200:
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
Run normalization on all submitted responses.

Auth: JWT

Response 200:
```json
{
  "normalized_count": 4,
  "eliminated_count": 1,
  "eliminated": [
    {
      "supplier_name": "Vendor C",
      "reason": "Total price $22,000 exceeds maximum budget $18,000"
    }
  ]
}
```

Side effect: Updates `normalized_data` and `flags` in all response rows. Sets `eliminated = true` for disqualified responses.

---

### GET /api/analysis/{rfq_id}/results
Get normalized results and compliance flags.

Auth: JWT

Response 200:
```json
{
  "qualifying": [
    {
      "supplier_name": "Studio A",
      "supplier_id": "uuid",
      "response_id": "uuid",
      "normalized_data": {
        "total_price_usd": 16500,
        "timeline_weeks": 3.5,
        "effective_total_cost": 17300,
        "revision_rounds_included": 2,
        "effective_revision_cost": 800
      },
      "flags": [],
      "score": null,
      "buyer_ratings": {}
    }
  ],
  "eliminated": [
    {
      "supplier_name": "Vendor C",
      "elimination_reason": "Total price $22,000 exceeds maximum budget $18,000"
    }
  ],
  "criteria": [...]
}
```

---

### POST /api/analysis/{rfq_id}/rate
Submit buyer ratings for buyer-rated criteria.

Auth: JWT

Request body:
```json
{
  "ratings": {
    "response_uuid_1": {
      "proposed_approach": 4,
      "portfolio": 5,
      "team_experience": 4
    },
    "response_uuid_2": {
      "proposed_approach": 3,
      "portfolio": 3,
      "team_experience": 3
    }
  }
}
```

All ratings must be integers 1–5. All buyer-rated criteria must have ratings for all qualifying suppliers.

Response 200:
```json
{"status": "ratings_saved"}
```

---

### POST /api/analysis/{rfq_id}/score
Calculate final scores for all qualifying suppliers.

Auth: JWT

Requires all buyer ratings to be submitted first.

Response 200:
```json
{
  "scores": [
    {
      "supplier_name": "Studio A",
      "response_id": "uuid",
      "score": 86.2,
      "score_breakdown": {
        "proposed_approach": {"raw_score": 80, "weight": 0.30, "weighted_score": 24.0},
        "price": {"raw_score": 88, "weight": 0.25, "weighted_score": 22.0},
        "portfolio": {"raw_score": 100, "weight": 0.25, "weighted_score": 25.0},
        "timeline": {"raw_score": 100, "weight": 0.10, "weighted_score": 10.0},
        "team_experience": {"raw_score": 80, "weight": 0.10, "weighted_score": 8.0}
      }
    }
  ]
}
```

---

### POST /api/analysis/{rfq_id}/memo
Generate the decision memo via Vertex AI.

Auth: JWT

Requires scoring to be complete first.

Response 200:
```json
{
  "memo_text": "SOURCING DECISION MEMO\n\nRECOMMENDATION\nWe recommend awarding...",
  "memo_pdf_url": null
}
```

The PDF is generated asynchronously via Cloud Task. Poll GET `/api/analysis/{rfq_id}/memo` to get the PDF URL when ready.

---

### GET /api/analysis/{rfq_id}/memo
Get the memo text and PDF download URL.

Auth: JWT

Response 200:
```json
{
  "memo_text": "SOURCING DECISION MEMO...",
  "memo_pdf_signed_url": "https://storage.googleapis.com/quoteflow-prod-files/decision-memos/uuid/memo.pdf?X-Goog-Signature=..."
}
```

`memo_pdf_signed_url` is null until the PDF Cloud Task completes (usually within 30 seconds of memo generation). The signed URL expires after 1 hour.

---

## Internal Task Endpoints

These endpoints are restricted to GCP internal traffic only. Not accessible from public internet. Authenticated via Cloud Tasks OIDC tokens.

### POST /internal/tasks/send-invitation
Send one supplier invitation email.

Auth: Cloud Tasks OIDC

Request body:
```json
{
  "invitation_id": "uuid",
  "supplier_email": "hello@studioa.com",
  "supplier_name": "Studio A",
  "rfq_title": "Video Production RFQ",
  "deadline": "2026-05-12T09:00:00Z",
  "portal_token": "64-char-random-string",
  "buyer_company": "Acme Manufacturing"
}
```

Response 200: `{"sent": true}`

---

### POST /internal/tasks/generate-pdf
Generate a PDF and store in GCS.

Auth: Cloud Tasks OIDC

Request body:
```json
{
  "rfq_id": "uuid",
  "type": "rfq",
  "content": "REQUEST FOR QUOTATION\n\n..."
}
```

`type` is either `"rfq"` or `"memo"`.

Response 200: `{"gcs_path": "rfq-documents/uuid/rfq.pdf"}`

---

### POST /internal/tasks/check-reminders
Triggered daily by Cloud Scheduler. Finds RFQs needing reminders and creates individual reminder tasks.

Auth: Cloud Scheduler (OIDC)

Request body: `{}`

Response 200:
```json
{
  "reminders_queued": 8
}
```

---

### POST /internal/tasks/send-deadline-reminder
Send one deadline reminder email to one supplier.

Auth: Cloud Tasks OIDC

Request body:
```json
{
  "invitation_id": "uuid",
  "days_remaining": 3
}
```

Response 200: `{"sent": true}`

---

### POST /internal/tasks/notify-response-received
Send buyer notification that a supplier has responded.

Auth: Cloud Tasks OIDC

Request body:
```json
{
  "rfq_id": "uuid",
  "supplier_name": "Studio A",
  "response_count": 2,
  "invited_count": 5,
  "buyer_email": "sarah@company.com",
  "buyer_name": "Sarah"
}
```

Response 200: `{"sent": true}`

---

### POST /internal/tasks/update-supplier-stats
Recalculate performance statistics for one supplier.

Auth: Cloud Tasks OIDC

Request body:
```json
{
  "supplier_id": "uuid"
}
```

Response 200: `{"updated": true}`

---

## File Access Endpoint

### GET /api/files/{gcs_object_path}
Generate a signed download URL for a file stored in GCS.

Auth: JWT (buyer must belong to org that owns the file)

URL path: GCS object path, e.g., `rfq-documents/uuid/rfq.pdf`

Response 200:
```json
{
  "signed_url": "https://storage.googleapis.com/quoteflow-prod-files/rfq-documents/uuid/rfq.pdf?X-Goog-Signature=...",
  "expires_at": "2026-04-28T11:00:00Z"
}
```

The client redirects to or opens the signed URL to download the file. Signed URLs expire after 1 hour.

---

## Admin Endpoints

### PUT /api/admin/organizations/{org_id}/tier
Manually set an organization's subscription tier. Used instead of payment integration.

Auth: JWT (owner or admin role only)

Request body:
```json
{
  "tier": "starter"
}
```

Valid values: `"free"`, `"starter"`, `"team"`, `"enterprise"`

Response 200:
```json
{"org_id": "uuid", "subscription_tier": "starter"}
```

---

*See 00-INDEX.md for the full file map*
