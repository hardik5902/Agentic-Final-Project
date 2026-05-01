# QuoteFlow — Claude Code Memory

## What This Is
AI-native buyer-side RFQ platform. Buyers describe needs → AI generates RFQ → suppliers respond via portal → AI normalizes, scores, generates decision memo.

**Stack:** Python 3.12 + FastAPI · React 18 + TypeScript · Cloud SQL PostgreSQL 16 · Memorystore Redis · Google ADK (agentic orchestration) + Vertex AI gemini-2.0-flash (LLM) · Google Cloud Storage · Cloud Tasks · Cloud Run + Docker · Secret Manager

**Services:** `backend/` (FastAPI API) · `buyer-portal/` (React) · `supplier-portal/` (React)

## Load Docs Before Coding
Always read the relevant doc before writing any code. Never guess at documented design decisions.

- Working on database / models / migrations → read `docs/02-database.md`
- Working on FastAPI routes or services → read `docs/03-backend-api.md`
- Working on Google ADK agents / Vertex AI / prompts / RFQ generation → read `docs/04-ai-engine.md`
- Working on React / frontend components → read `docs/05-frontend.md`
- Working on email / GCS / Cloud Tasks / normalization / scoring → read `docs/06-infrastructure.md`
- Working on Docker / Cloud Run / GCP setup / deployment → read `docs/07-deployment.md`
- Checking API contracts or endpoint shapes → read `docs/08-api-reference.md`
- Not sure? → read `docs/00-INDEX.md`

## Non-Negotiable Rules

**Security — org isolation**
Every database query touching buyer data MUST filter by `org_id`. Enforce in every service function. Return 404 (not 403) when resource not found or belongs to different org.

**Architecture**
- Routers are thin: validate input → call one service → return result. Zero business logic in routers.
- All business logic lives in `backend/services/`. Never in routers or models.
- Slow operations (email, PDF, stats) go through Cloud Tasks. Never call them synchronously.

**AI vs deterministic split — never violate this**
- Google ADK agents orchestrate multi-step agentic flows (conversation loop, field extraction, RFQ generation, memo writing).
- Vertex AI with `gemini-2.0-flash` is the LLM backend for all text generation and structure extraction.
- Currency conversion, scoring, compliance checks, landed cost = deterministic Python always.
- Never ask Gemini to do arithmetic or make pass/fail decisions.

**Google ADK + Vertex AI**
- Use `google-adk` (`google.adk.agents.Agent`, `google.adk.runners.Runner`) for all agentic orchestration.
- LLM calls go through Vertex AI: `vertexai.init(project=..., location=...)` then `GenerativeModel("gemini-2.0-flash")`.
- Auth is via service account IAM (`roles/aiplatform.user`). No API key in production.
- For local dev: `gcloud auth application-default login` — ADK picks up ambient credentials automatically.
- Wrap every Vertex AI call in try/except with one retry then graceful fallback.

**Secrets**
- Production secrets live in GCP Secret Manager only.
- Never put secrets in `.env`, Docker images, or code.

**GCP service map**
- Background jobs → Cloud Tasks (not Celery)
- Cron → Cloud Scheduler (not Celery Beat)
- File storage → Google Cloud Storage (not S3)
- Secrets → Secret Manager (not env vars)

## Quick Reference
```
# Local dev
docker-compose up -d                    # start postgres + redis
gcloud auth application-default login   # Vertex AI auth locally
uvicorn main:app --reload --port 8080   # backend
npm run dev                             # frontends (port 3000 / 3001)
alembic upgrade head                    # run migrations
```

Key domain terms: RFQ Event · Invitation (one per supplier per RFQ) · Conversation (AI chat to build RFQ) · Category Template (JSON in backend/templates/) · Normalization (deterministic Python) · Compliance Flags (hard/soft) · Scoring (weighted arithmetic) · Decision Memo (Gemini prose via ADK agent → WeasyPrint PDF → GCS)
