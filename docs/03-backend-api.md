# QuoteFlow - 03: Backend API Design

> Load this file when: working on FastAPI routes, services, business logic, or backend structure

---

## Project Structure

```text
backend/
|-- main.py
|-- config.py
|-- database.py
|-- models/
|-- schemas/
|-- routers/
|   |-- auth.py
|   |-- rfq.py
|   |-- suppliers.py
|   |-- responses.py
|   |-- analysis.py
|   `-- internal_tasks.py
|-- services/
|   |-- ai_service.py
|   |-- rfq_service.py
|   |-- email_service.py
|   |-- storage_service.py
|   |-- normalization_service.py
|   |-- scoring_service.py
|   `-- memo_service.py
`-- templates/
```

---

## Design Principle

Routers stay thin. They:

1. Validate auth.
2. Validate request data.
3. Call service logic.
4. Return a typed response.

Business logic lives in services.

---

## Authentication Modes

### Buyer JWT Auth

Used by buyer portal endpoints.

### Supplier Token Auth

Used by supplier portal endpoints in `routers/responses.py`.

There are now two supplier access patterns:

1. `GET /api/response/{token}/portal`
   Loads the supplier inbox tied to the supplier behind that invitation token.

2. `GET /api/response/{invite_token}`
   Loads one RFQ response view for a specific invitation.

The portal token and invite token can be the same token value when entering from email, but the frontend now treats inbox access and per-RFQ response access as distinct routes.

### Internal Task Auth

Used by `/internal/tasks/*` endpoints via Cloud Tasks OIDC validation.

---

## Supplier Portal Backend Behavior

`routers/responses.py` now supports:

- Inbox loading for all invitations belonging to a supplier
- Viewing a submitted response after initial submission
- Updating an existing response while the RFQ remains open
- Blocking new access, submissions, and questions when the RFQ is closed

Important backend rules:

- Invalid tokens return `404`
- Closed RFQs return `400`
- Non-submitted suppliers are blocked after the deadline
- Submitted suppliers can still reopen their response until close/deadline
- First valid access marks the invitation as `viewed`

---

## AI Service Responsibilities

`services/ai_service.py` is responsible for:

- RFQ category identification
- RFQ question/response orchestration
- RFQ document generation
- Supplier response evaluation
- Decision memo generation

The current Vertex model in the repo is `gemini-2.5-flash`.

The memo wording now uses recommendation language such as:

- `PREFERRED SUPPLIER`
- `SHORTLIST`
- `NO SELECTION`

instead of award-oriented wording.

---

## Memo Service Behavior

`services/memo_service.py`:

1. Gathers scored qualifying suppliers and eliminated suppliers.
2. Extracts buyer intent from stored RFQ conversation.
3. Calls `ai_service.generate_decision_memo(...)`.
4. Saves memo text immediately to the RFQ row.
5. Queues PDF generation asynchronously through Cloud Tasks.

This means memo text is available before the PDF URL is ready.

---

## Analysis Service Behavior

The backend analysis layer now supports two separate buyer actions:

- Deterministic normalization and scoring
- AI response evaluation via `/api/analysis/{rfq_id}/evaluate`

These are intentionally separate so buyers can inspect structured scores and optional AI commentary independently.

---

## Error Handling

Standard backend error shape:

```json
{
  "detail": "Human-readable error message"
}
```

Common statuses:

- `200` success
- `201` created
- `400` invalid state or invalid input
- `401` unauthorized
- `403` forbidden
- `404` not found
- `422` validation error

---

## Current Notable Contracts

- Supplier inbox endpoint: `GET /api/response/{token}/portal`
- Supplier response load: `GET /api/response/{token}`
- Supplier initial submit: `POST /api/response/{token}`
- Supplier update submit: `PUT /api/response/{token}`
- AI response evaluation: `POST /api/analysis/{rfq_id}/evaluate`
- Memo generation: `POST /api/analysis/{rfq_id}/memo`

---

*See 00-INDEX.md for the full file map*
