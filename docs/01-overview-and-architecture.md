# QuoteFlow — 01: Overview and Architecture

> Load this file when: understanding the system, starting a new feature, orienting to the codebase

---

## Product Summary

### What QuoteFlow Does

QuoteFlow replaces the email-and-Excel supplier sourcing process that mid-market companies use today. A buyer describes what they need in plain language. The AI asks targeted clarifying questions, generates a professional RFQ document, sends it to suppliers via a structured response portal, normalizes all responses automatically, scores each supplier against weighted criteria, and produces a sourcing decision memo with a clear recommendation.

### Core User Journey

```
Buyer describes need in plain language
            ↓
AI asks clarifying questions one at a time
            ↓
AI generates professional RFQ document
            ↓
Buyer approves and selects suppliers to invite
            ↓
Suppliers receive email with structured portal link
            ↓
Suppliers fill typed response fields — no PDF attachments
            ↓
QuoteFlow normalizes all responses automatically
            ↓
Buyer rates subjective criteria
            ↓
QuoteFlow scores all suppliers and flags violations
            ↓
AI generates sourcing decision memo
            ↓
Buyer approves recommendation
```

### What QuoteFlow Is NOT

- Not a marketplace — suppliers do not sign up or maintain profiles
- Not a purchase order or payment system
- Not a contract management tool
- Not an accounts payable platform

---

## System Architecture

### Five Major Systems

**Buyer Portal** — React web application containerized with Docker and served via Cloud Run. Buyers create RFQs, manage suppliers, view responses, and approve recommendations.

**Supplier Portal** — Separate React application containerized with Docker and served via a dedicated Cloud Run service. No supplier account required. Suppliers fill in a structured form and submit.

**Core API** — FastAPI backend containerized with Docker and deployed on Cloud Run. Handles all business logic, authentication, data access, and orchestration between systems.

**AI Engine** — Python service using Google ADK for agentic orchestration and Vertex AI (`gemini-2.0-flash`) as the LLM backend for RFQ generation, field extraction, and memo writing. All normalization and scoring logic is deterministic Python — not AI.

**Data Layer** — Cloud SQL (PostgreSQL 16) as the primary database, Memorystore (Redis) for session management and caching, Google Cloud Storage for file storage.

### System Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         GCP PROJECT                            │
│                                                                │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │  Cloud Run       │  │  Cloud Run       │                   │
│  │  Buyer Portal    │  │  Supplier Portal │                   │
│  │  (React+Docker)  │  │  (React+Docker)  │                   │
│  └────────┬─────────┘  └────────┬─────────┘                   │
│           │                     │                             │
│  ┌────────▼─────────────────────▼──────────────────────────┐  │
│  │              Cloud Run — FastAPI Backend                  │  │
│  │         (Docker container — scales to zero)              │  │
│  │   /auth  /rfq  /suppliers  /responses  /analysis        │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                  │
│  ┌──────────────────────────▼───────────────────────────────┐  │
│  │           Cloud Tasks + Cloud Scheduler                   │  │
│  │   Email sending — Reminders — PDF generation              │  │
│  └────────┬─────────────────────────┬────────────────────────┘  │
│           │                         │                          │
│  ┌────────▼────────┐  ┌─────────────▼──────┐  ┌────────────┐  │
│  │  Cloud SQL      │  │   Memorystore      │  │   GCS      │  │
│  │  PostgreSQL 16  │  │   Redis 7          │  │  (files)   │  │
│  │  (primary data) │  │ (sessions/cache)   │  │            │  │
│  └─────────────────┘  └────────────────────┘  └────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Vertex AI (Claude models)                    │  │
│  │         RFQ generation — Field extraction — Memos        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Secret Manager                           │  │
│  │      JWT key — DB password — SendGrid key                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Artifact Registry + Cloud Build                 │  │
│  │         Docker image storage — CI/CD pipeline            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘

External (outside GCP):
  SendGrid        — Email delivery
  ExchangeRate API — Currency conversion
```

### Data Flow for a Complete RFQ Event

```
Step 1 — Buyer starts RFQ
  API creates RFQ record and conversation record
  AI identifies product category via Vertex AI
  AI returns first clarifying question

Step 2 — Conversation loop (multiple turns)
  Each buyer answer is appended to conversation history
  AI checks completeness against category template
  AI returns next question or completion signal

Step 3 — RFQ generation
  AI extracts structured fields from conversation
  AI generates RFQ document text via Vertex AI
  PDF version generated and stored in Google Cloud Storage
  RFQ record updated with requirements and document

Step 4 — Approval and invitation
  Buyer reviews document, sets deadline and criteria weights
  Buyer selects suppliers to invite
  Unique token generated per supplier
  Cloud Tasks job sends invitation emails via SendGrid

Step 5 — Supplier response (supplier side)
  Supplier opens link — no login required
  Supplier sees RFQ document and structured form
  Supplier fills in typed fields and uploads files
  Submission stored in Cloud SQL — buyer notified

Step 6 — Analysis
  Normalization runs: currency, units, landed cost, flags
  Compliance checks flag deadline and budget violations
  Buyer rates subjective criteria (portfolio, approach)
  Scoring engine calculates weighted scores

Step 7 — Decision
  AI generates decision memo via Vertex AI
  PDF memo stored in GCS and shown to buyer
  Buyer approves — PO draft available for download
```

---

## Technology Stack

### Full Stack Choices

| Layer | Technology | Reason |
|---|---|---|
| Buyer Frontend | React 18 + TypeScript | Type safety, component reuse |
| Supplier Frontend | React 18 + TypeScript | Separate simpler app |
| Frontend Containerization | Docker + Cloud Run | Same GCP infrastructure as backend |
| Styling | Tailwind CSS | Rapid development |
| API State | React Query | Caching and loading states |
| Backend | Python 3.12 + FastAPI | Async, fast, excellent DX |
| Backend Containerization | Docker + Cloud Run | Serverless, scales to zero |
| ORM | SQLAlchemy 2.0 | Mature, flexible |
| Validation | Pydantic v2 | Request and response validation |
| Primary DB | Cloud SQL — PostgreSQL 16 | Managed GCP PostgreSQL, JSONB support |
| Cache | Memorystore — Redis 7 | Managed GCP Redis |
| Background Jobs | Cloud Tasks | Managed GCP job queue, no worker process |
| Scheduled Jobs | Cloud Scheduler | Managed GCP cron, replaces Celery Beat |
| AI Orchestration | Google ADK | Agentic flows — conversation loop, multi-step pipelines |
| AI LLM | Vertex AI — gemini-2.0-flash | GCP-native Gemini, IAM auth, data residency |
| File Storage | Google Cloud Storage | GCP-native, free egress within project |
| Email | SendGrid | Deliverability and templates |
| Currency | ExchangeRate-API | Free tier sufficient |
| PDF Generation | WeasyPrint | HTML to PDF in Python |
| CI/CD | Cloud Build + Artifact Registry | GCP-native Docker build and deploy |
| Secrets | Secret Manager | GCP-native secret storage, no .env in prod |
| Error Tracking | Sentry | Production error monitoring |
| Analytics | PostHog | Product usage analytics |

### Why These Choices

**Cloud Run over a dedicated server** — Serverless containers that scale to zero. You pay only when requests are being handled. No server management. Auto-scales during traffic spikes. Both frontend and backend run on Cloud Run in Docker containers.

**Docker for everything** — Containerizing both frontends and the backend gives consistent environments between local development and production. Cloud Run requires Docker images — Artifact Registry stores them, Cloud Build builds them automatically on every git push.

**Google ADK + Vertex AI over direct Gemini API** — Google ADK provides the agentic orchestration layer (conversation state machines, tool routing, multi-step pipelines). Vertex AI provides the LLM backend (`gemini-2.0-flash`) with IAM authentication, consolidated GCP billing, and data residency within GCP infrastructure.

**Cloud Tasks over Celery** — Cloud Tasks is a fully managed queue. No Celery worker process to deploy and monitor. No Redis instance just for queuing. Cloud Tasks calls your Cloud Run API endpoint when a job is ready — the same FastAPI service handles both web requests and background tasks.

**Cloud SQL over self-managed PostgreSQL** — Automatic backups, point-in-time recovery, automatic failover, security patching. Connects to Cloud Run via Cloud SQL Auth Proxy — no public internet exposure for the database.

**Secret Manager over environment variables** — Secrets stored in GCP Secret Manager with audit logging. Cloud Run service account is granted access to specific secrets. Nothing sensitive in `.env` files or CI/CD pipelines.

**FastAPI over Django** — Faster to build APIs, native async support, automatic OpenAPI documentation, Pydantic integration.

**Separate supplier portal** — Keeps the supplier experience simple and focused. No shared components with buyer complexity.

---

*See 00-INDEX.md for the full file map*
