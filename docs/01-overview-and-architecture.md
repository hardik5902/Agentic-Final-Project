# QuoteFlow - 01: Overview and Architecture

> Load this file when: understanding the system, starting a new feature, orienting to the codebase

---

## Product Summary

QuoteFlow replaces the email-and-Excel supplier sourcing process with a guided RFQ workflow. Buyers describe what they need in plain language, the AI helps shape a structured RFQ, suppliers respond through a dedicated portal, and QuoteFlow normalizes, compares, and summarizes the results.

The current product flow is:

1. Buyer starts an RFQ in the buyer portal.
2. AI asks clarifying questions and generates the RFQ document.
3. Buyer approves the RFQ and invites suppliers.
4. Suppliers receive tokenized links into the supplier portal.
5. Each supplier lands in a lightweight inbox showing all RFQs associated with that supplier record.
6. Suppliers can submit a response and later update it until the RFQ closes or the deadline passes.
7. Buyer normalizes responses, calculates scores, reviews supplier responses, and can generate AI response analyses.
8. Buyer generates a sourcing decision memo with a preferred supplier recommendation and optional PDF export.

What QuoteFlow is not:

- Not a marketplace.
- Not a purchase order or payment system.
- Not a contract management tool.
- Not a supplier self-serve onboarding platform.

---

## Major Systems

### Buyer Portal

React + TypeScript application served separately from the supplier experience. Buyers create RFQs, manage suppliers, review responses, run analysis, and generate decision memos.

### Supplier Portal

Separate React + TypeScript application with no supplier login. Suppliers enter through invitation tokens, see an inbox of received RFQs, open one response at a time, and can revisit submitted responses while edits are still allowed.

### Core API

FastAPI backend that handles JWT auth for buyers, token auth for suppliers, database access, scoring, normalization, invitation workflows, and AI orchestration entry points.

### AI Engine

Backend AI services built on Google ADK and Vertex AI `gemini-2.5-flash`. Used for RFQ generation, field extraction, response evaluation, and memo generation. Deterministic Python handles normalization and scoring.

### Data Layer

- PostgreSQL for application data
- Google Cloud Storage for generated PDFs and uploaded files
- Cloud Tasks for async work
- Redis/Memorystore for cache or rate-limiting support where enabled

---

## High-Level Flow

### RFQ Creation

1. Buyer starts an RFQ.
2. Conversation state is stored in the backend.
3. AI identifies category and asks follow-up questions.
4. RFQ document text is generated and stored.

### Invitation

1. Buyer approves the RFQ with deadline and scoring criteria.
2. One invitation row and one token are created per supplier.
3. Invitation emails are sent asynchronously.

### Supplier Response

1. Supplier opens the invitation link.
2. The portal uses that token to resolve the supplier and load the supplier inbox.
3. The supplier opens a specific RFQ response view.
4. The supplier submits or updates structured form data.
5. Shared buyer answers remain visible through the same response flow.

### Buyer Analysis

1. Buyer normalizes submitted responses.
2. Deterministic scoring calculates supplier scores.
3. Buyer can review eliminated and qualifying suppliers side by side.
4. Buyer can generate AI response analyses from the memo area.

### Decision Memo

1. AI generates a memo with a preferred supplier, shortlist, or no-selection recommendation.
2. Memo text is saved immediately.
3. PDF generation is queued asynchronously.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Buyer frontend | React 18 + TypeScript + Tailwind |
| Supplier frontend | React 18 + TypeScript + Tailwind |
| Backend | FastAPI + SQLAlchemy + Pydantic |
| AI | Google ADK + Vertex AI `gemini-2.5-flash` |
| Database | PostgreSQL |
| Storage | Google Cloud Storage |
| Background jobs | Cloud Tasks |
| Containers | Docker |
| Hosting | Cloud Run |

---

## Design Notes

- Supplier and buyer experiences are intentionally separate apps.
- Supplier access is token-based, not account-based.
- Memo generation is recommendation-oriented; it does not directly award a supplier.
- Response evaluation and memo generation are separate AI actions.
- Scoring and normalization remain deterministic and auditable.

---

*See 00-INDEX.md for the full file map*
