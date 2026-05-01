# QuoteFlow — Technical Documentation Index

> AI-Native Buyer-Side RFQ Platform | GCP Edition
> Version 2.0 — April 2026

---

## How to use these docs

Each file covers one concern area. Claude Code should load only the file relevant to the task at hand — do not load all files simultaneously.

---

## File Map

| File | Sections | Load when working on |
|---|---|---|
| `01-overview-and-architecture.md` | Product summary, system architecture, technology stack | Understanding the system, starting a new feature |
| `02-database.md` | Database design, all table definitions, relationships | Database models, migrations, queries |
| `03-backend-api.md` | FastAPI structure, routers, services, request flow | Backend endpoints, business logic, services |
| `04-ai-engine.md` | Vertex AI setup, prompts, conversation loop, failure handling | AI service, RFQ generation, memo writing |
| `05-frontend.md` | Buyer portal, supplier portal, screens, components, state | React apps, UI components, frontend logic |
| `06-infrastructure.md` | Email, file storage, background jobs, normalization, scoring, memo PDF | SendGrid, GCS, Cloud Tasks, analysis pipeline |
| `07-deployment.md` | Auth/security, build timeline, environment, GCP setup, CI/CD, costs | Deployment, Docker, Cloud Run, secrets |
| `08-api-reference.md` | All API endpoints, auth types, internal task endpoints | API contracts, integration, testing |

---

## GCP Services Used

```
Cloud Run          — All three services (API, buyer portal, supplier portal)
Cloud SQL          — PostgreSQL 16 primary database
Memorystore        — Redis 7 for caching and sessions
Vertex AI          — Claude models for AI generation
Google Cloud Storage — File storage (PDFs, uploads)
Cloud Tasks        — Background job queue
Cloud Scheduler    — Daily reminder cron
Secret Manager     — All secrets and credentials
Cloud Build        — CI/CD pipeline
Artifact Registry  — Docker image storage
```

## External Services

```
SendGrid           — Email delivery
ExchangeRate-API   — Currency conversion (free tier)
Sentry             — Error tracking (free tier)
PostHog            — Product analytics (free tier)
```

## Quick Reference

- Backend language: Python 3.12 + FastAPI
- Frontend: React 18 + TypeScript + Tailwind CSS
- AI: Vertex AI (Claude claude-sonnet-4-6) — IAM auth, no API key
- Database ORM: SQLAlchemy 2.0 + Pydantic v2
- All services containerized with Docker
- Deploy region: pick one and use everywhere (recommended: us-east5)

---

*QuoteFlow Technical Plan — GCP Edition — Version 2.0 — April 2026*
