# QuoteFlow — AI-Native B2B Procurement Platform

> An end-to-end RFQ (Request for Quotation) platform where four specialised AI agents guide buyers from sourcing need → supplier selection, while deterministic Python handles all scoring, compliance, and normalisation.

**Live URLs**
| Service | URL |
|---|---|
| Buyer Portal | https://quoteflow-buyer-727209058163.us-central1.run.app |
| Supplier Portal | https://quoteflow-supplier-727209058163.us-central1.run.app |
| Backend API | https://quoteflow-backend-727209058163.us-central1.run.app |

---

## Quick Demo — How to Run QuoteFlow End to End

> Try it live at **[quoteflow-buyer-727209058163.us-central1.run.app](https://quoteflow-buyer-727209058163.us-central1.run.app)**

**Step 1 — Log in as a buyer**
Register or sign in on the buyer portal. This gives you an isolated org workspace.

**Step 2 — Create an RFQ and add suppliers**
Click **New RFQ**. Add at least one supplier — you can use a demo email (e.g. `you can put your personal email`) to test the full flow end to end.

**Step 3 — Chat with the AI to build your RFQ**
Describe what you need in plain language. The AI intake agent asks clarifying questions, detects the category (professional services / SaaS / marketing), and generates a formal RFQ document. Keep answering until the document preview appears.

**Step 4 — Send the invitation email**
Click **Send Invitations**. Each supplier receives a unique portal link by email. Check the spam folder — transactional emails may land there on first send.

**Step 5 — Open the supplier portal**
Click the link in the email. You land directly on the supplier dashboard — no account or password required. The RFQ document is displayed on the left.

**Step 6 — Fill in the response or ask a clarifying question**
As a supplier, complete the structured response form. If anything in the RFQ is unclear, use the **Ask a question** box — it sends a confidential message to the buyer. Once done, click **Submit Response**.

**Step 7 — Back on the buyer dashboard: run AI analysis**
Return to the buyer portal. Click **Analyse** on the RFQ. The AI evaluation agent reviews each supplier response for ambiguities, missing evidence, and compliance failures, and shows a per-supplier report.

**Step 8 — Calculate scores**
Click **Calculate Scores**. The deterministic scoring engine normalises currencies and timelines, applies weighted criteria, and ranks all qualifying suppliers. Eliminated suppliers (e.g. over budget) are separated out automatically.

**Step 9 — Generate the memo and get the final verdict**
Open the RFQ, click **Generate Memo + AI Analysis**. The decision support agent writes a CFO-ready sourcing memo with a clear **PREFERRED SUPPLIER** or **NO SELECTION** verdict, backed by cited evidence. The verdict banner appears at the top — details are available on demand via collapsible cards.

---

## Table of Contents

1. [What QuoteFlow Does](#1-what-quoteflow-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Academic Concepts Implemented](#3-academic-concepts-implemented)
   - [Multi-Agent Patterns](#31-multi-agent-patterns)
   - [Context Engineering](#32-context-engineering)
   - [Conversational AI / Chatbots](#33-conversational-ai--chatbots)
   - [Agent Framework (Google ADK)](#34-agent-framework-google-adk)
   - [Constrained Decoding & Structured Output](#35-constrained-decoding--structured-output)
4. [Tech Stack](#4-tech-stack)
5. [Project Structure](#5-project-structure)
6. [How to Run Locally](#6-how-to-run-locally)
7. [How to Deploy to GCP](#7-how-to-deploy-to-gcp)
8. [End-to-End Flow Walkthrough](#8-end-to-end-flow-walkthrough)
9. [Data Model](#9-data-model)
10. [AI vs Deterministic Split](#10-ai-vs-deterministic-split)

---

## 1. What QuoteFlow Does

Traditional procurement is manual, slow, and inconsistent. A buyer writes an RFQ in Word, emails it to a list, receives PDFs in different formats, and compares them in a spreadsheet.

QuoteFlow replaces every part of that:

```
Buyer describes need in plain language
        ↓
AI agent asks clarifying questions → generates formal RFQ document
        ↓
AI ranks suppliers → buyer approves and invites them
        ↓
Suppliers fill a structured form (no email, no PDF)
        ↓
Deterministic Python normalises currencies, timelines, costs
        ↓
AI evaluation agent flags ambiguities, missing evidence, compliance failures
        ↓
Weighted scoring engine calculates scores (pure arithmetic — no AI)
        ↓
Decision support agent writes sourcing memo with explicit AWARD / NO SELECTION verdict
        ↓
CFO-ready memo with progressive disclosure: verdict first, evidence on demand
```

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GCP Cloud Run                            │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │ Buyer Portal │   │  Backend API │   │ Supplier Portal  │   │
│  │ React + Vite │◄──┤  FastAPI     ├──►│  React + Vite    │   │
│  │ Port 8080    │   │  Port 8080   │   │  Port 8080       │   │
│  └──────────────┘   └──────┬───────┘   └──────────────────┘   │
│                             │                                   │
│              ┌──────────────┼──────────────┐                   │
│              │              │              │                   │
│     ┌────────▼───┐  ┌───────▼────┐  ┌────▼──────┐           │
│     │ Cloud SQL  │  │ Memorystore│  │    GCS    │           │
│     │ PostgreSQL │  │   Redis    │  │  Storage  │           │
│     └────────────┘  └───────────┘  └───────────┘           │
│                                                                 │
│              ┌──────────────────────────────┐                  │
│              │       Vertex AI              │                  │
│              │   gemini-2.5-flash           │                  │
│              │   (4 agentic agents)         │                  │
│              └──────────────────────────────┘                  │
│                                                                 │
│     Cloud Tasks (async jobs) · Cloud Scheduler · Secret Manager│
└─────────────────────────────────────────────────────────────────┘
```

**Three separate Cloud Run services** — buyer portal, supplier portal, and backend API — each independently deployable. Suppliers access their portal via a unique 64-character token embedded in their invitation URL. No login required on the supplier side.

---

## 3. Academic Concepts Implemented

### 3.1 Multi-Agent Patterns

QuoteFlow implements the **Specialist Agent Pattern** — a set of independent, task-scoped agents each with a single responsibility, rather than one monolithic LLM doing everything.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FOUR SPECIALIST AGENTS                       │
│                                                                 │
│  Agent 1: RFQ Creation Agent                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input:  buyer message + conversation history            │   │
│  │         + fields_collected + required_fields            │   │
│  │ Output: next question + extracted fields +              │   │
│  │         contradiction warning + category suggestion     │   │
│  │ File:   backend/services/ai_service.py → process_message│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Agent 2: Supplier Sourcing Agent                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input:  RFQ requirements + supplier profiles            │   │
│  │ Output: fit_score, fit_reasoning, batch (1|2),          │   │
│  │         recommended flag per supplier                   │   │
│  │ File:   backend/services/ai_service.py → rank_suppliers │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Agent 3: Response Evaluation Agent                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input:  all submitted supplier responses + requirements  │   │
│  │ Output: ambiguous_fields, missing_evidence,             │   │
│  │         clarification_questions, compliance_failures,   │   │
│  │         strategic_concerns, evaluation_summary          │   │
│  │ File:   backend/services/ai_service.py → evaluate_responses│ │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Agent 4: Decision Support Agent                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Input:  ranked scores + eliminated list + buyer intent  │   │
│  │ Output: PREFERRED SUPPLIER | SHORTLIST | NO SELECTION   │   │
│  │         + risk analysis + uncertainty + next steps      │   │
│  │ File:   backend/services/ai_service.py →                │   │
│  │         generate_decision_memo                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Why specialist agents instead of one agent?**

Each agent receives only the data it needs, with a precisely scoped system instruction. This is cheaper (fewer tokens per call), more reliable (focused prompt = less hallucination), and independently testable. The agents never talk to each other — the backend orchestrates them in sequence, passing structured outputs as inputs to the next stage.

This is the **Sequential Pipeline** multi-agent pattern (as opposed to hierarchical/swarm patterns). Each agent's output is a typed, validated data structure consumed by the next layer.

**Key implementation detail — why not ADK Runner for all agents?**

Agents 1–4 use direct `_call_vertex()` single-turn calls rather than ADK `Runner`. ADK `Runner` adds session management overhead useful for multi-turn loops. These four agents are each single-shot: one prompt in, one JSON out. The RFQ Document generator and Memo writer use ADK `Runner` because they benefit from the agent's stateful instruction context.

```python
# backend/services/ai_service.py — direct Vertex call for specialist agents
def _call_vertex(system: str, prompt: str, max_tokens: int = 1500) -> str | None:
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text

# ADK Runner used for document generation (stateful, longer output)
async for event in _generation_runner.run_async(...):
    if event.is_final_response() and event.content:
        result += part.text
```

---

### 3.2 Context Engineering

Context engineering is the practice of deliberately constructing what the model sees — what to include, what to exclude, how to frame it, and in what order — to maximise output quality without increasing model size.

QuoteFlow applies context engineering at every agent call:

#### a) Sliding Window Conversation Context (Agent 1)

Rather than passing the full conversation history (which grows unboundedly and hits token limits), Agent 1 receives only the **last 6 messages**. This gives the model enough context to understand what it already asked without wasting tokens on old exchanges.

```python
# backend/services/rfq_service.py — sliding window
recent_messages = (conversation.messages or [])[-6:]

await ai_service.process_message(
    ...
    recent_messages=recent_messages,
)
```

```python
# backend/services/ai_service.py — formatted into prompt
conversation_context = "\nRecent conversation:\n" + "\n".join(
    f"{'Buyer' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
    for m in recent_messages
)
```

**Why this matters:** Without conversation context, the AI only sees the latest buyer message (e.g., "yes, 3 months") with no knowledge of what was asked. It cannot extract `timeline_weeks` correctly because it doesn't know the question was about timeline. With the last 6 messages, it has the Q&A pair and extracts correctly.

#### b) State Injection (fields_collected)

Instead of re-deriving what has been collected from the conversation transcript, the agent receives the already-extracted structured state:

```python
f"Fields collected so far: {json.dumps(fields_collected)}\n"
f"Still missing: {json.dumps(missing)}\n"
```

This prevents the model from re-asking questions about fields already answered, and focuses it on the single most important missing field.

#### c) Buyer Intent Extraction for Decision Support

The memo agent receives the buyer's original natural-language intent (first 5 messages from intake), not just the formal RFQ. This lets it detect when a supplier technically meets the criteria but misses the spirit of what the buyer actually wanted.

```python
# backend/services/memo_service.py
def _extract_buyer_intent(db, rfq):
    buyer_messages = [m["content"] for m in conversation.messages if m["role"] == "user"]
    return " | ".join(buyer_messages[:5])

# Passed into decision support agent prompt
f"Buyer's stated intent (from intake conversation):\n{buyer_intent}\n"
```

#### d) Requirement Summary Compression (Supplier Ranking)

The full RFQ requirements object can be large. The sourcing agent only receives the fields relevant to supplier matching:

```python
# backend/services/ai_service.py → rank_suppliers
req_summary = {
    k: rfq_requirements.get(k)
    for k in ["service_type", "budget_max", "timeline_weeks",
              "deliverables", "industry_experience_required"]
    if rfq_requirements.get(k)
}
```

Only 5 fields are injected — not the entire requirements dict — because those are the signals a human procurement specialist would use to mentally match a supplier.

---

### 3.3 Conversational AI / Chatbots

The RFQ creation flow is a **goal-directed conversational agent** — distinct from open-ended chatbots in that it has an explicit completion criterion: all required fields collected.

#### Architecture of the Intake Chatbot

```
User sends message
        ↓
rfq_service.send_message()
        ↓
process_message() — Agent 1 returns JSON:
  {
    "assistant_message": "What is your maximum budget?",
    "updated_fields": {"service_type": "IT consulting"},
    "missing_fields": ["budget_min", "budget_max", "timeline_weeks"],
    "contradiction": null,
    "category_suggestion": null
  }
        ↓
Merge updated_fields into conversation.fields_collected (DB)
        ↓
Recompute fields_remaining
        ↓
If fields_remaining is empty → generate RFQ document
If not → return assistant_message to frontend
```

Key files:
- `backend/services/rfq_service.py` — orchestration logic, state persistence
- `backend/services/ai_service.py` → `process_message()` — LLM call
- `backend/models/rfq.py` → `RFQConversation` — persists `messages[]`, `fields_collected`, `fields_remaining`
- `buyer-portal/src/pages/NewRFQ.tsx` — chat UI, sessionStorage draft persistence
- `buyer-portal/src/components/ChatInterface.tsx` — message rendering

#### Conversation State is Persisted, Not In-Memory

Unlike a simple chatbot that lives in browser memory, QuoteFlow persists conversation state in PostgreSQL (`RFQConversation` table). This means:
- Browser refresh doesn't lose the conversation
- The buyer can leave and resume later (`/rfq/new?resume=<id>`)
- The backend can reconstruct context for any agent at any time

```python
# backend/models/rfq.py
class RFQConversation(Base):
    messages        = Column(JSONB)          # full [{role, content}] history
    fields_collected = Column(JSONB)         # extracted structured state
    fields_remaining = Column(JSONB)         # which fields still needed
    is_complete      = Column(Boolean)       # signals RFQ ready to generate
```

#### Contradiction Detection

Agent 1 actively checks for logical inconsistencies in buyer answers and surfaces them inline:

```python
# backend/services/rfq_service.py
if contradiction:
    response_text = f"⚠️ Potential inconsistency detected: {contradiction}\n\n{response_text}"
```

Example: buyer states "$5,000 budget" but also "team of 10 consultants for 6 months" — the agent flags this mismatch before the RFQ is generated.

#### Dynamic Category Switching

If the buyer's description evolves (e.g., starts describing IT consulting but the need is actually SaaS procurement), the agent suggests a category switch and the backend re-maps collected fields to the new template's schema:

```python
# backend/services/rfq_service.py → send_message
if active_category != current_category:
    new_template = load_template(active_category)
    kept_fields = {k: v for k, v in fields_collected.items()
                   if k in new_template_fields}   # re-map, don't discard
    conversation.template_used = active_category
    rfq.category = active_category
```

---

### 3.4 Agent Framework (Google ADK)

**Google Agent Development Kit (ADK)** provides the scaffolding for multi-turn agent sessions, tool registration, and event streaming.

#### How ADK is Used

Two agents are wrapped in ADK `Agent` + `Runner`: the RFQ document generator and the memo writer. These benefit from ADK's session management because their outputs are long-form prose that may stream across multiple events.

```python
# backend/services/ai_service.py
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

rfq_generation_agent = Agent(
    name="rfq_generation_agent",
    model="gemini-2.5-flash",
    instruction="You are a professional procurement writer...",
)

memo_agent = Agent(
    name="memo_agent",
    model="gemini-2.5-flash",
    instruction="You are a senior procurement analyst...",
)

_generation_runner = Runner(agent=rfq_generation_agent, ...)
_memo_runner = Runner(agent=memo_agent, ...)
```

#### Streaming Event Loop

ADK runners emit events as the model generates output. QuoteFlow consumes the final response event:

```python
async for event in _generation_runner.run_async(
    user_id="system",
    session_id=session_id,
    new_message=content,
):
    if event.is_final_response() and event.content:
        for part in event.content.parts:
            if part.text:
                result += part.text
```

#### Tool Registration

ADK supports registering Python functions as tools that the agent can call. The `extract_fields_tool` is registered on the generation agent — demonstrating the tool-use pattern even though the primary extraction happens via direct Vertex calls for reliability:

```python
# backend/services/ai_service.py
from google.adk.tools import FunctionTool

def _extract_fields(conversation_json: str, fields_json: str) -> str:
    # calls _call_vertex internally
    ...

extract_fields_tool = FunctionTool(_extract_fields)
```

#### Why ADK + Direct Vertex (Hybrid Approach)

| Use case | Mechanism | Why |
|---|---|---|
| RFQ document generation | ADK Runner | Long prose, benefits from streaming |
| Decision memo | ADK Runner | Long structured markdown |
| Process message (intake) | Direct `_call_vertex` | Short JSON, single turn, faster |
| Supplier ranking | Direct `_call_vertex` | Returns JSON array, no session needed |
| Response evaluation | Direct `_call_vertex` | Per-batch, stateless |

---

### 3.5 Constrained Decoding & Structured Output

**Constrained decoding** is the technique of restricting a language model's output to a valid structure (JSON schema, grammar, token whitelist) rather than free-form text. QuoteFlow implements this at the prompt level and with post-processing fallbacks.

#### Prompt-Level Constraints

Every specialist agent system prompt ends with an explicit output contract:

```python
# Agent 1 (process_message) — system prompt
"Return ONLY a valid JSON object — no markdown, no extra text — with these keys:\n"
'"assistant_message": string\n'
'"updated_fields": object\n'
'"missing_fields": array\n'
'"contradiction": string|null\n'
'"category_suggestion": string|null\n'
```

```python
# Agent 2 (rank_suppliers)
"Return ONLY a JSON array. No markdown, no explanation outside the array."

# Agent 3 (evaluate_responses)
"Return ONLY a JSON array. No markdown outside the array."
```

The model is constrained to produce parseable output by design of the prompt, not by model-level token masking.

#### Robust Fallback Parsing

Real models sometimes ignore instructions and wrap JSON in markdown fences or add preamble text. The `_extract_json` function handles this with two layers of recovery:

```python
# backend/services/ai_service.py
def _extract_json(text: str) -> dict:
    # Layer 1: strip markdown fences
    clean = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        # Layer 2: regex extraction — find outermost {...} even if prose surrounds it
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        logger.error("Failed to parse AI JSON output: %s", clean[:200])
        return {}
```

This two-layer approach (clean → parse → regex extract → log and fallback) is a production-grade pattern for working with LLMs that occasionally break output format constraints.

#### Token Budget as Output Constraint

Token limits are themselves a form of constraint. Each agent has a tuned `max_output_tokens` matching its expected output size:

```python
_call_vertex(system, prompt, max_tokens=1500)  # process_message — medium JSON
_call_vertex(system, prompt, max_tokens=2500)  # rank_suppliers — larger JSON array
_call_vertex(system, prompt, max_tokens=3000)  # evaluate_responses — per-supplier objects
```

Setting tokens too low truncates JSON mid-object (the root cause of the repeated-question bug fixed in this project: `"Failed to parse AI JSON output: {"`).

#### Category ID Constraint

`identify_category` constrains the model to return exactly one string from a known enum — a minimal structured output problem:

```python
# backend/services/ai_service.py
categories = get_available_categories()  # ["professional_services", "marketing_agencies", "saas_tools"]
system = f"Return exactly one category ID from this list: {categories}. No explanation. No punctuation."
result = _call_vertex(system, description, max_tokens=20)
# Validated after: if clean not in categories → default to professional_services
```

`max_tokens=20` is itself a constraint — the model physically cannot write a long response.

#### Deterministic Scoring (No AI Arithmetic)

A critical architectural constraint: **the scoring engine never calls an LLM**. All arithmetic is deterministic Python in `backend/services/scoring_service.py`. This is the answer to "can we trust the scores?"

```python
# backend/services/scoring_service.py — pure Python, no AI
if name == "price":
    raw = (best_price / supplier_price) * 100   # relative scoring
elif name == "timeline":
    raw = (best_timeline / supplier_timeline) * 100

weighted = round(raw * weight, 1)
score += weighted
```

The AI writes the prose *explaining* the scores. It never computes them.

---

## 4. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| LLM | Vertex AI gemini-2.5-flash | Multimodal, fast, cheap per token, native GCP auth |
| Agent framework | Google ADK | Session management, tool registration, streaming |
| Backend | FastAPI (Python 3.12) | Async-native, Pydantic validation, OpenAPI docs |
| ORM / migrations | SQLAlchemy + Alembic | Type-safe queries, version-controlled schema |
| Database | Cloud SQL PostgreSQL 16 | ACID compliance, JSONB for flexible fields |
| Cache / exchange rates | Memorystore Redis | 24h exchange rate caching, rate limiting |
| File storage | Google Cloud Storage | RFQ PDFs, signed URLs for download |
| Background jobs | Cloud Tasks | Async email, PDF generation, stats updates |
| PDF generation | WeasyPrint | HTML→PDF server-side, no browser dependency |
| Buyer portal | React 18 + TypeScript + Vite | Type-safe, fast HMR, TanStack Query for server state |
| Supplier portal | React 18 + TypeScript + Vite | Same stack, separate deployment |
| Styling | Tailwind CSS | Utility-first, no CSS files |
| Deployment | Cloud Run | Scale to zero, zero-downtime deploys |
| Secrets | Secret Manager | No secrets in env files or images |
| Email | SendGrid | Transactional invitation emails |

---

## 5. Project Structure

```
Agentic-Final-Project/
├── backend/
│   ├── main.py                        # FastAPI app, CORS, router registration
│   ├── config.py                      # Settings from Secret Manager / env vars
│   ├── database.py                    # SQLAlchemy engine, session factory
│   │
│   ├── models/
│   │   ├── rfq.py                     # RFQEvent, RFQConversation
│   │   ├── response.py                # Response, SupplierQuestion
│   │   ├── invitation.py              # Invitation (token-based supplier access)
│   │   ├── supplier.py                # Supplier profile + performance stats
│   │   ├── user.py                    # Buyer user (JWT auth)
│   │   └── organization.py            # Multi-tenant org isolation
│   │
│   ├── routers/
│   │   ├── rfq.py                     # /api/rfq/* — create, approve, list
│   │   ├── analysis.py                # /api/analysis/* — normalize, score, memo
│   │   ├── responses.py               # /api/response/* — supplier portal endpoints
│   │   ├── suppliers.py               # /api/suppliers/* — CRUD
│   │   ├── auth.py                    # /api/auth/* — login, register, JWT
│   │   └── internal_tasks.py          # /internal/* — Cloud Tasks callbacks
│   │
│   ├── services/
│   │   ├── ai_service.py              # ← ALL FOUR AI AGENTS live here
│   │   ├── rfq_service.py             # RFQ creation flow orchestration
│   │   ├── memo_service.py            # Memo generation + buyer intent extraction
│   │   ├── normalization_service.py   # Deterministic: currency, timeline, landed cost
│   │   ├── scoring_service.py         # Deterministic: weighted arithmetic scoring
│   │   ├── auth_service.py            # JWT encode/decode, bcrypt password hashing
│   │   ├── email_service.py           # SendGrid invitation emails
│   │   ├── storage_service.py         # GCS upload, signed URL generation
│   │   └── cloud_tasks.py             # Enqueue background jobs
│   │
│   ├── templates/
│   │   ├── professional_services.json  # Category schema + form fields + criteria
│   │   ├── marketing_agencies.json
│   │   ├── saas_tools.json
│   │   └── loader.py                   # load_template(), get_available_categories()
│   │
│   ├── schemas/                        # Pydantic request/response models
│   ├── migrations/                     # Alembic migration files
│   ├── Dockerfile                      # Multi-stage Python build
│   └── cloudbuild.yaml                 # CI/CD pipeline definition
│
├── buyer-portal/
│   └── src/
│       ├── pages/
│       │   ├── NewRFQ.tsx             # Chat interface + supplier selection + criteria
│       │   ├── Analysis.tsx           # Normalize / Score / View responses
│       │   ├── Memo.tsx               # Decision memo with verdict banner
│       │   ├── Dashboard.tsx          # RFQ list
│       │   ├── RFQDetail.tsx          # RFQ detail + Q&A
│       │   └── Suppliers.tsx          # Supplier management
│       ├── components/
│       │   ├── ChatInterface.tsx      # Message bubbles + input
│       │   ├── SupplierTable.tsx      # AI fit scores + batch badges
│       │   ├── ScoreCard.tsx          # Per-supplier score breakdown bars
│       │   ├── CriteriaBuilder.tsx    # Drag-to-weight evaluation criteria
│       │   └── RFQPreview.tsx         # Markdown → structured document preview
│       └── hooks/
│           ├── useRFQ.ts              # All RFQ API mutations + queries
│           └── useAnalysis.ts         # Analysis + memo hooks
│
└── supplier-portal/
    └── src/
        ├── pages/
        │   ├── ResponseForm.tsx       # Dynamic form + pre-fill + edit + questions
        │   ├── Dashboard.tsx          # Supplier inbox
        │   └── Confirmation.tsx       # Post-submit summary
        └── components/
            ├── RFQViewer.tsx          # Markdown renderer (line-by-line parser)
            ├── FormField.tsx          # Renders any field type from JSON schema
            └── QuestionBox.tsx        # Confidential question to buyer
```

---

## 6. How to Run Locally

### Prerequisites

- Python 3.12
- Node.js 20
- Docker + Docker Compose
- Google Cloud SDK (`gcloud`)
- A GCP project with Vertex AI API enabled

### Step 1 — Clone and configure

```bash
git clone <repo-url>
cd Agentic-Final-Project
```

Create `backend/.env` for local development only (never commit this):

```bash
DATABASE_URL=postgresql+psycopg2://quoteflow:localpassword@localhost:5432/quoteflow
REDIS_URL=redis://localhost:6379
SECRET_KEY=any-64-char-random-string-for-local-dev
GCP_PROJECT_ID=your-gcp-project-id
GCP_REGION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=1
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
SENDGRID_API_KEY=optional-for-local
EMAIL_FROM=you@example.com
FRONTEND_URL=http://localhost:3000
SUPPLIER_PORTAL_URL=http://localhost:3001
```

### Step 2 — Start infrastructure

```bash
docker-compose up -d   # starts PostgreSQL + Redis
```

### Step 3 — Authenticate with Vertex AI

```bash
gcloud auth application-default login
# ADK and Vertex AI SDK pick up these credentials automatically
```

### Step 4 — Install and run backend

```bash
cd backend
pip install uv
uv sync                          # installs from pyproject.toml / uv.lock
alembic upgrade head             # runs database migrations
uvicorn main:app --reload --port 8080
# API docs available at http://localhost:8080/docs
```

### Step 5 — Install and run buyer portal

```bash
cd buyer-portal
npm install
npm run dev    # runs on http://localhost:3000
```

### Step 6 — Install and run supplier portal

```bash
cd supplier-portal
npm install
npm run dev    # runs on http://localhost:3001
```

### Step 7 — Verify

1. Open http://localhost:3000 — register a buyer account
2. Create a new RFQ — describe your sourcing need in plain language
3. Answer the AI's questions until the RFQ document appears
4. Add a supplier, approve the RFQ, check the invitation email
5. Open the supplier portal link — fill the response form
6. Back in the buyer portal: Analysis page → Normalize → Score → Generate memo

---

## 7. How to Deploy to GCP

All three services are deployed to Cloud Run. The backend uses Cloud Build (CI/CD); the portals use manual `gcloud builds submit`.

### Backend (includes DB migrations in cloudbuild.yaml)

```bash
cd Agentic-Final-Project
gcloud builds submit --config cloudbuild.yaml --project YOUR_PROJECT_ID
```

This builds the Docker image, pushes to Artifact Registry, and deploys to Cloud Run with all environment variables and Cloud SQL connection.

### Buyer Portal

```bash
cd buyer-portal
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/quoteflow-buyer . --project YOUR_PROJECT_ID
gcloud run deploy quoteflow-buyer \
  --image gcr.io/YOUR_PROJECT_ID/quoteflow-buyer \
  --region us-central1 \
  --project YOUR_PROJECT_ID
```

### Supplier Portal

```bash
cd supplier-portal
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/quoteflow-supplier . --project YOUR_PROJECT_ID
gcloud run deploy quoteflow-supplier \
  --image gcr.io/YOUR_PROJECT_ID/quoteflow-supplier \
  --region us-central1 \
  --project YOUR_PROJECT_ID
```

---

## 8. End-to-End Flow Walkthrough

### Phase 1 — RFQ Creation (Buyer)

```
POST /api/rfq/start
  → identify_category()         # which of 3 templates fits?
  → RFQEvent created in DB
  → RFQConversation created
  → process_message()           # Agent 1: first question

POST /api/rfq/{id}/message  (repeated per buyer reply)
  → process_message()           # Agent 1: extract fields, next question
  → fields_collected updated in DB
  → when fields_remaining == [] → build_rfq_document() → rfq.rfq_document saved
  → Cloud Task: polish-rfq (AI polish in background)
  → Cloud Task: generate-pdf
```

### Phase 2 — Supplier Sourcing (Buyer)

```
GET /api/rfq/{id}/suggest-suppliers
  → rank_suppliers()            # Agent 2: fit scores for all org suppliers
  → returns sorted list with fit_score, batch, reasoning

POST /api/rfq/{id}/approve
  → deadline set, criteria saved
  → Invitation records created (one per supplier, unique 64-char token)
  → Cloud Task: send-invitation email per supplier
```

### Phase 3 — Supplier Response

```
GET /api/response/{token}
  → validates token
  → loads template form fields (from JSON category template)
  → returns submitted_data for pre-fill if already responded
  → returns my_questions (confidential Q&A with buyer)

POST /api/response/{token}          # first submission
PUT  /api/response/{token}          # update (clears normalized_data, score)

POST /api/response/{token}/question
  → SupplierQuestion created with is_shared_with_all=False
  → confidential — only visible to this supplier + buyer
```

### Phase 4 — Analysis (Buyer)

```
POST /api/analysis/{id}/normalize
  → normalization_service.normalize() per response
  → currency conversion (live exchange rates via exchangerate-api, cached in Redis)
  → timeline standardisation to weeks
  → landed cost calculation
  → compliance flags (hard: budget exceeded → eliminated; soft: portfolio shortage)

POST /api/analysis/{id}/score
  → scoring_service.score_suppliers()
  → relative pricing: score = (best_price / supplier_price) × 100
  → relative timeline: score = (best_timeline / supplier_timeline) × 100
  → weighted sum across criteria

POST /api/analysis/{id}/evaluate
  → evaluate_responses()        # Agent 3: qualitative review
  → per-supplier: ambiguous fields, missing evidence, clarification questions

POST /api/analysis/{id}/memo
  → _extract_buyer_intent()     # pulls buyer's original language from conversation
  → generate_decision_memo()    # Agent 4: verdict + risk + next steps
  → memo_text saved to DB
  → Cloud Task: generate-pdf → GCS → signed URL
```

---

## 9. Data Model

```
Organization ──< User
     │
     └──< RFQEvent ──── RFQConversation
              │
              ├──< Invitation ──────────── Supplier
              │         │
              │         └──< Response (raw_data, normalized_data, score, flags)
              │
              └──< SupplierQuestion (is_shared_with_all=False → confidential)
```

Key design decisions:
- **`org_id` on every buyer query** — prevents cross-tenant data leakage (`backend/services/rfq_service.py`, `backend/routers/analysis.py`)
- **`JSONB` for flexible fields** — `raw_data`, `normalized_data`, `fields_collected`, `criteria` are all schema-flexible JSON columns, letting category templates define their own field sets without schema migrations
- **`is_shared_with_all=False`** on supplier questions — confidentiality between buyer and individual supplier (`backend/routers/responses.py`)
- **Stale data invalidation** — updating a response clears `normalized_data`, `score`, `flags` so the next normalize/score run uses fresh data (`backend/routers/responses.py → update_response`)

---

## 10. AI vs Deterministic Split

This boundary is the most important architectural decision in the system. It determines what can be audited, what can be trusted, and where bugs come from.

| Operation | AI or Deterministic | File | Why |
|---|---|---|---|
| Identify RFQ category | AI (constrained) | `ai_service.py` | Requires semantic understanding |
| Ask next question | AI | `ai_service.py` | Requires conversational judgment |
| Extract field values from text | AI | `ai_service.py` | NLP extraction |
| Detect contradictions | AI | `ai_service.py` | Logical reasoning |
| Generate RFQ document | AI (ADK) | `ai_service.py` | Prose generation |
| Rank suppliers by fit | AI | `ai_service.py` | Multi-signal judgment |
| Evaluate response quality | AI | `ai_service.py` | Qualitative analysis |
| Write decision memo | AI (ADK) | `ai_service.py` | Narrative reasoning |
| Currency conversion | **Deterministic** | `normalization_service.py` | Arithmetic — must be exact |
| Timeline standardisation | **Deterministic** | `normalization_service.py` | Arithmetic |
| Landed cost calculation | **Deterministic** | `normalization_service.py` | Arithmetic |
| Compliance pass/fail | **Deterministic** | `normalization_service.py` | Objective threshold |
| Weighted scoring | **Deterministic** | `scoring_service.py` | Must be auditable |
| JWT auth | **Deterministic** | `auth_service.py` | Security |

**The rule: if it's a number or pass/fail, it's Python. If it's a sentence explaining something, it's AI.**

---

## References

- [Google Agent Development Kit (ADK)](https://google.github.io/adk-docs/)
- [Vertex AI Generative AI](https://cloud.google.com/vertex-ai/generative-ai/docs)
- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [Cloud Run documentation](https://cloud.google.com/run/docs)
- [TanStack Query (React Query)](https://tanstack.com/query/latest)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
- [Alembic migrations](https://alembic.sqlalchemy.org/)
