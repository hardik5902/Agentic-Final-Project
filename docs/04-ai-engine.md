# QuoteFlow — 04: AI Engine Design

> Load this file when: working on Google ADK agents, Vertex AI integration, RFQ generation, prompts, or the conversation loop

---

## Core Principle: AI vs Deterministic

This separation is critical and must be maintained strictly.

**Google ADK + Vertex AI (Gemini) handles:**
- Identifying the product category from a buyer's description
- Generating clarifying questions during RFQ creation (agentic conversation loop via ADK)
- Extracting structured fields from completed conversations
- Generating the RFQ document prose
- Writing the decision memo narrative

**Deterministic Python handles:**
- Currency conversion (arithmetic on exchange rates)
- Lead time unit standardization (multiplication)
- Landed cost calculation (arithmetic)
- Budget compliance checking (comparison operator)
- Timeline compliance checking (comparison operator)
- Supplier scoring (weighted arithmetic)
- Compliance flag detection (comparison operators)

**Why this matters:** The AI cannot make mathematical errors in scoring or compliance because it never does that work. A supplier is eliminated because `effective_total_cost > budget_max` — a Python comparison. This makes the system auditable and reliable. Users can always see exactly why a decision was made.

---

## Architecture: Google ADK + Vertex AI

Two distinct layers work together:

**Google ADK (`google-adk`)** — agentic orchestration layer
- Manages the multi-turn conversation state machine for RFQ creation
- Routes tool calls (e.g. `extract_fields`, `generate_rfq_document`)
- Provides `Agent` and `Runner` abstractions that handle turn management and tool dispatch
- Lives in `backend/services/ai_service.py` — ADK agents are instantiated once and reused

**Vertex AI (`vertexai` SDK)** — LLM backend
- All text generation calls go through Vertex AI using `gemini-2.0-flash`
- ADK is configured to use Vertex AI as its model backend
- IAM-authenticated — no API key

---

## Vertex AI Authentication

No API key. Vertex AI uses GCP IAM.

```python
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(
    project=settings.GCP_PROJECT_ID,
    location=settings.GCP_REGION
)

model = GenerativeModel("gemini-2.0-flash")
```

The Cloud Run service account has `roles/aiplatform.user`. This role is granted in GCP IAM — not in code. The SDK automatically uses the ambient GCP credentials from the runtime environment.

For local development: run `gcloud auth application-default login`. Both the ADK and Vertex AI SDK pick up credentials automatically. No separate setup needed in code.

Model to use: `gemini-2.0-flash`

---

## Google ADK Setup

```python
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

# ADK agent configured with Vertex AI backend
rfq_agent = Agent(
    name="rfq_conversation_agent",
    model="gemini-2.0-flash",           # ADK routes this to Vertex AI
    description="Guides buyer through RFQ creation",
    instruction="...",                  # system prompt
    tools=[extract_fields_tool, ...],
)

session_service = InMemorySessionService()
runner = Runner(agent=rfq_agent, session_service=session_service, app_name="quoteflow")
```

ADK handles turn-by-turn conversation state. Each buyer message is passed to the runner; the runner manages history and tool calls transparently.

---

## GCP Region

All Vertex AI calls must be in the same region as the Cloud Run service. Available regions for Gemini on Vertex AI:

- `us-east5` — Ohio, recommended for US users
- `europe-west1` — Belgium, for EU data residency
- `us-central1` — Iowa, alternative US

Set once in `GCP_REGION` secret. Never split services across regions.

---

## ADK Agent Definitions

QuoteFlow uses three ADK agents, each with a focused responsibility:

**`rfq_conversation_agent`** — drives the multi-turn clarifying question loop with the buyer. Tools: `check_field_completeness`, `extract_fields`. Signals `READY_TO_GENERATE` when all required fields are collected.

**`rfq_generation_agent`** — given extracted fields and a template, generates the RFQ document text. No tools — pure generation.

**`memo_agent`** — given scored results and eliminated suppliers, writes the decision memo narrative. No tools — pure generation.

Each agent is instantiated once at app startup in `ai_service.py` and reused across requests.

---

## Category Template System

Templates are JSON files in `backend/templates/`. Each template defines what fields to collect and what the supplier response form looks like. The AI uses the template as a guide — it only asks about fields defined in the template.

Template structure:
```json
{
  "category_id": "professional_services",
  "category_name": "Professional Services",
  "subcategories": ["marketing_agency", "it_consulting", ...],
  "required_fields": ["service_type", "budget_min", "budget_max", "timeline_weeks"],
  "optional_fields": ["industry_experience_required", "nda_required"],
  "response_form_fields": [
    {"field_id": "total_price", "type": "number", "required": true},
    {"field_id": "timeline_value", "type": "number", "required": true},
    ...
  ],
  "normalization_rules": {...},
  "default_evaluation_criteria": [...],
  "compliance_checks": [...]
}
```

Initial three templates: `professional_services.json`, `saas_tools.json`, `marketing_agencies.json`

---

## RFQ Creation Conversation Loop

The conversation follows a structured state machine managed by the `rfq_conversation_agent` (Google ADK). The state is persisted in `rfq_conversations.fields_collected` and `rfq_conversations.fields_remaining` in the database; ADK's `InMemorySessionService` holds the active turn state during a request.

```
State: {fields_collected: {}, fields_remaining: [all required fields]}

Loop (each buyer message = one ADK runner.run() call):
  1. Buyer sends message → POST /api/rfq/{id}/message
  2. rfq_service loads conversation history from DB, resumes ADK session
  3. ADK runner passes message to rfq_conversation_agent (Vertex AI / gemini-2.0-flash)
  4. Agent returns either:
     a. A clarifying question → save to DB history, return to buyer
     b. Calls extract_fields tool → signals READY_TO_GENERATE → exit loop
  5. rfq_service persists updated fields_collected / fields_remaining to DB
  6. Repeat

After loop exits:
  → rfq_generation_agent generates RFQ document text (Vertex AI call)
  → PDF generation queued as Cloud Task
  → Save to rfq_events
```

The agent is constrained by the template via its system prompt. It cannot ask about fields not in the template. It cannot invent requirements. This ensures consistent behavior across all RFQ events.

---

## The Five AI Tasks

All five tasks use Vertex AI `gemini-2.0-flash` as the LLM backend. Tasks 2–3 are orchestrated by ADK agents; tasks 1, 4, 5 are direct Vertex AI `GenerativeModel.generate_content()` calls.

### 1. Category Identification

**Agent/Call:** Direct Vertex AI call (no ADK needed — single-turn)
**Purpose:** Determine which template to load.
**Input:** Buyer's initial description
**Output:** Exactly one category string from the available list
**Constraint:** Must return only a name from the list, nothing else.

System prompt: Lists available categories, instructs model to return exactly one, defines fallback to "professional_services" if unclear.

### 2. Clarification Question (ADK conversation loop)

**Agent/Call:** `rfq_conversation_agent` via ADK `Runner`
**Purpose:** Ask the buyer for one missing piece of information per turn.
**Input:** Template fields, fields already collected (injected into agent context), buyer message
**Output:** A single natural-language question OR triggers `extract_fields` tool call
**Constraint:** Ask about ONE field only per turn. Call `extract_fields` tool when all required fields are collected.

Agent system prompt includes:
- The template's `required_fields` list
- The current `fields_collected` dict (what we know)
- Instruction to call the `extract_fields` tool when all required fields are filled
- Instruction to be conversational, not robotic

### 3. Field Extraction (ADK tool)

**Agent/Call:** `extract_fields` tool registered on `rfq_conversation_agent`
**Purpose:** Convert conversation history into a structured dict.
**Input:** Full conversation history, list of field names to extract
**Output:** Valid JSON only — no preamble, no markdown fences
**Constraint:** Return null for any field not mentioned. Do not invent values.

Called by the ADK agent as a tool when conversation is complete. Result is saved to `rfq_conversations.fields_collected` and `rfq_events.requirements`.

Post-processing: Strip any accidental markdown fences before JSON parsing. Wrap in try/except — if parse fails, return empty dict and flag for manual review.

### 4. Document Generation

**Agent/Call:** `rfq_generation_agent` via ADK `Runner` (single-turn)
**Purpose:** Generate the full RFQ document text.
**Input:** Extracted fields dict, template section structure, organization name
**Output:** 400–700 word professional document with clear sections
**Constraint:** Use only actual values from fields — no placeholders like [INSERT X]. Must include all standard sections.

Required sections: Company overview, project description, scope of work, timeline and budget, vendor qualifications, response instructions, evaluation criteria.

### 5. Decision Memo

**Agent/Call:** `memo_agent` via ADK `Runner` (single-turn)
**Purpose:** Write the sourcing decision memo narrative.
**Input:** Scored supplier results, eliminated suppliers with reasons, evaluation criteria weights
**Output:** 350–500 word memo with five required sections
**Constraint:** Only use information provided in input — cannot invent facts.

Required sections: Recommendation, Eliminated Suppliers, Evaluation Summary, Risk Considerations, Recommended Next Steps.

---

## Failure Handling

All Vertex AI calls (direct and via ADK) are wrapped in try/except. Retry once with a 2-second wait before falling back.

| Function | Failure fallback |
|---|---|
| `identify_category` | Return `"professional_services"` |
| ADK conversation turn (question) | Retry runner.run() once, then return a generic "Can you tell me more about your requirements?" |
| `extract_fields` tool | Retry once, then return empty dict — flag `rfq_conversation.is_complete = False` and return error to buyer |
| `generate_rfq_document` (ADK) | Retry once, then return a minimal template-filled document without AI prose |
| `generate_decision_memo` (ADK) | Retry once, then return a structured data table instead of narrative |

Never let an AI failure block a user action entirely. Always degrade gracefully.

---

## Cost Monitoring

Vertex AI (`gemini-2.0-flash`) charges per token. At production scale, cost is approximately $0.01–$0.03 per complete RFQ event (creation through memo) — Gemini Flash is significantly cheaper than Claude.

Set a GCP Billing budget alert at $50/month during development. At 1,000 RFQ events per month the AI cost is well under $30.

Token counts per call type (approximate):
- Category identification: 200 input, 20 output
- Each clarifying question turn: 800 input, 100 output (4 turns average)
- Field extraction: 2,500 input, 400 output
- Document generation: 1,500 input, 700 output
- Memo generation: 3,000 input, 600 output

ADK itself does not add token overhead — it passes messages directly to the Vertex AI model.

---

## Testing AI Prompts

Before deploying any prompt change, test it manually:

1. Open the Vertex AI console or use the Python client locally
2. Run 10 varied inputs through the changed prompt
3. Check outputs match expected format and content
4. Check edge cases: empty descriptions, very long descriptions, non-English input, adversarial input

Prompt changes should be version-controlled in the template files. Never change prompts in production without testing on at least 10 representative inputs.

---

*See 00-INDEX.md for the full file map*
