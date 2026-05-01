# QuoteFlow — 03: Backend API Design

> Load this file when: working on FastAPI routes, services, business logic, or backend structure

---

## Project Structure

```
backend/
├── main.py                   — App entry point, middleware, router registration
├── config.py                 — Settings loaded from GCP Secret Manager
├── database.py               — Cloud SQL connection via SQLAlchemy
├── models/                   — SQLAlchemy ORM models (one per table)
│   ├── organization.py
│   ├── user.py
│   ├── rfq.py
│   ├── supplier.py
│   ├── invitation.py
│   └── response.py
├── schemas/                  — Pydantic v2 request/response validation schemas
│   ├── auth.py
│   ├── rfq.py
│   ├── supplier.py
│   └── response.py
├── routers/                  — FastAPI route handlers — thin layer only
│   ├── auth.py
│   ├── rfq.py
│   ├── suppliers.py
│   ├── responses.py          — Supplier portal endpoints (token auth)
│   ├── analysis.py
│   └── internal_tasks.py     — Cloud Tasks endpoints (OIDC auth)
├── services/                 — All business logic lives here
│   ├── ai_service.py         — Vertex AI calls
│   ├── rfq_service.py        — RFQ generation orchestration
│   ├── email_service.py      — SendGrid integration
│   ├── storage_service.py    — Google Cloud Storage
│   ├── normalization_service.py — Response normalization
│   ├── scoring_service.py    — Supplier scoring
│   └── memo_service.py       — Decision memo generation + PDF
├── templates/                — Category template JSON files
│   ├── loader.py             — Load and validate templates
│   ├── professional_services.json
│   ├── saas_tools.json
│   └── marketing_agencies.json
└── Dockerfile                — Production container definition
```

---

## Key Design Principle

**Routers are thin.** A router function does three things only:
1. Validate the JWT or token
2. Validate the request body via Pydantic schema
3. Call a service function and return the result

All business logic, database queries, and external API calls live in services. This keeps routes readable and services testable in isolation.

---

## Request Flow

```
HTTP Request arrives at Cloud Run
    ↓
FastAPI Router
    — Check Authorization header → validate JWT (buyer routes)
    — Check URL token → validate against invitations table (supplier routes)
    — Check OIDC token → validate Cloud Tasks service account (internal routes)
    — Validate request body via Pydantic schema
    — Return 401/422 immediately if validation fails
    ↓
Service Layer
    — Business logic
    — Database queries via SQLAlchemy (always filter by org_id)
    — External API calls: Vertex AI, GCS, SendGrid, ExchangeRate-API
    — Create Cloud Tasks for background work
    ↓
Response
    — Pydantic schema validates output format
    — JSON returned to client
```

---

## Config and Secrets

`config.py` loads secrets from GCP Secret Manager at startup — not from `.env` files in production. In local development, environment variables are used as a fallback.

```python
# Priority order for each secret:
# 1. GCP Secret Manager (production)
# 2. Environment variable (local dev)
# 3. Default value (if safe to have one)
```

The Cloud Run service account must have `roles/secretmanager.secretAccessor` to read secrets.

---

## Database Connection

`database.py` manages the SQLAlchemy session factory. Cloud Run connects to Cloud SQL via the Cloud SQL Auth Proxy sidecar — the DATABASE_URL points to `localhost:5432` even in production.

Every router that needs the database uses `Depends(get_db)` to get a session. Sessions are always closed in a `finally` block to prevent connection leaks.

**Critical rule:** Every query that touches buyer data must include a filter on `org_id`. This is the primary data isolation mechanism. Enforce this in every service function — never rely on the router to do it.

---

## Authentication Middleware

### JWT Authentication (buyer routes)

```
Buyer logs in → API returns JWT token
JWT stored in browser localStorage
Every request includes: Authorization: Bearer {token}
FastAPI dependency get_current_user():
  → Decode JWT
  → Load user from database
  → Return user object
  → Router receives user as parameter
```

JWT tokens expire after 7 days. The secret key for signing is loaded from Secret Manager.

### Token Authentication (supplier portal routes)

```
Supplier receives email with URL containing token
GET /api/response/{token}
API looks up token in invitations table
Validates: token exists, status != 'responded', deadline not passed
Marks invitation as 'viewed' if first access
Returns RFQ data for that invitation only
```

Tokens are 64-character URL-safe random strings. One token per invitation — never reused.

### Cloud Tasks OIDC Authentication (internal task routes)

```
Cloud Tasks calls POST /internal/tasks/{task_name}
Request includes OIDC token from Cloud Tasks service account
FastAPI middleware validates the OIDC token
Verifies token audience matches this Cloud Run service URL
Cloud Run ingress also restricts /internal/* to internal GCP traffic only
```

Internal routes are never exposed to the public internet via Cloud Run's ingress settings.

---

## Service Descriptions

### ai_service.py

Handles all AI calls via Google ADK (agentic orchestration) and Vertex AI `gemini-2.0-flash` (LLM backend).

Initialises Vertex AI at module load:
```python
import vertexai
vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)
```

Instantiates three ADK agents at startup: `rfq_conversation_agent`, `rfq_generation_agent`, `memo_agent`.

Exposes five functions:

- `identify_category(description)` → category string (direct Vertex AI call)
- `process_message(rfq_id, message, template, fields)` → question string or `"READY_TO_GENERATE"` (ADK runner)
- `extract_fields(conversation, template)` → structured dict (ADK tool, called internally by agent)
- `generate_rfq_document(fields, template, org_name)` → document text string (ADK single-turn)
- `generate_decision_memo(rfq, scores, eliminated)` → memo text string (ADK single-turn)

All wrapped in try/except with retry once on failure. See `04-ai-engine.md` for full detail.

### rfq_service.py

Orchestrates the RFQ creation flow. Loads templates, checks field completeness, coordinates between ai_service and the database. Handles the conversation state machine.

### email_service.py

Wraps SendGrid. Four email types: invitation, reminder, response_received, deadline_passed. Uses HTML templates with plain text fallback. SPF and DKIM configured on the sending domain.

### storage_service.py

Wraps `google-cloud-storage`. Uses the Cloud Run service account credentials automatically — no explicit auth setup in code. Generates signed URLs with 1-hour expiry for downloads. Validates file type and size before upload.

### normalization_service.py

Pure Python — no external calls except ExchangeRate-API for currency rates (cached in Redis). Takes `raw_data` dict and `requirements` dict, returns `normalized_data` dict and `flags` list. See `06-infrastructure.md` for full normalization steps.

### scoring_service.py

Pure Python arithmetic. Takes normalized responses and criteria weights, returns scored and ranked list. No AI involved. See `06-infrastructure.md` for the scoring formula.

### memo_service.py

Calls `ai_service.generate_decision_memo()` then converts the text to PDF via WeasyPrint. Uploads PDF to GCS via `storage_service`. Returns the GCS object path.

---

## Background Task Pattern

When a route needs to trigger background work, it creates a Cloud Tasks HTTP task pointing to the corresponding `/internal/tasks/` endpoint. It does NOT call the service function directly.

```
Route handler
  → validate and save to database
  → create Cloud Task (fast — just an HTTP call to Cloud Tasks API)
  → return 200 to client immediately

Cloud Tasks (async, seconds to minutes later)
  → calls POST /internal/tasks/{task_name}
  → internal_tasks router handles it
  → calls the service function
  → updates database with result
```

This pattern ensures the client never waits for slow operations (email sending, PDF generation).

---

## Error Handling

Every router returns consistent error shapes:

```json
{
  "detail": "Human-readable error message"
}
```

Standard HTTP status codes:
- `200` — success
- `201` — created
- `400` — bad request (invalid input)
- `401` — unauthorized (invalid or missing token)
- `403` — forbidden (valid token but wrong org)
- `404` — not found
- `422` — validation error (Pydantic)
- `500` — server error (logged to Sentry + Cloud Logging)

Database errors are caught in services and re-raised as HTTPExceptions with appropriate status codes. Never expose raw database errors to the client.

---

## Rate Limiting

Redis-based (Memorystore) rate limiting applied via FastAPI middleware:

- Auth endpoints: 5 requests per minute per IP
- Supplier portal endpoints: 10 requests per minute per token
- All other endpoints: 60 requests per minute per user

Limits prevent brute force on auth and scraping of supplier portal.

---

## Tier Enforcement

The free tier allows 3 RFQ events per month. Checked in `rfq_service.py` before creating a new RFQ:

```
Load organization
Check organization.subscription_tier
If 'free':
  Check monthly_rfq_count < 3
  Check monthly_rfq_reset_date (reset on 1st of month)
  If limit reached: raise HTTPException(403, "Free tier limit reached")
If 'starter' or 'team': no limit check
```

Tier is set manually via an admin endpoint — no payment integration in this version.

---

*See 00-INDEX.md for the full file map*
