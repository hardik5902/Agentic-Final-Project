"""
AI service — Google ADK (agentic orchestration) + Vertex AI gemini-2.5-flash (LLM).

Four agentic capabilities:
  process_message       — RFQ creation agent: contradictions, category detection, field extraction
  rank_suppliers        — Supplier sourcing agent: fit scoring, batch suggestion, reasoning
  evaluate_responses    — Response evaluation agent: ambiguities, missing evidence, clarification Qs
  generate_decision_memo — Decision support agent: intent alignment, award recommendation, uncertainty
"""

import json
import logging
import time
from datetime import date

from google import genai
from google.genai import types as genai_types
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool

from config import settings
from templates.loader import get_available_categories

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"

def _get_client() -> genai.Client:
    return _genai_client

# Initialise once at import time — avoids per-request auth overhead
_genai_client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT_ID,
    location=settings.GCP_REGION,
)

# ─── helpers ─────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    clean = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        logger.error("Failed to parse AI JSON output: %s", clean[:200])
        return {}


def _extract_json_list(text: str) -> list:
    clean = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(clean)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        logger.error("Failed to parse AI JSON list: %s", clean[:200])
        return []


def _call_vertex(system: str, prompt: str, max_tokens: int = 1500) -> str | None:
    """Single-turn Vertex AI call with one retry."""
    client = _get_client()
    for attempt in range(2):
        try:
            logger.debug("Vertex AI call attempt=%d max_tokens=%d prompt_len=%d", attempt + 1, max_tokens, len(prompt))
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=max_tokens,
                ),
            )
            logger.debug("Vertex AI response len=%d", len(response.text or ""))
            return response.text
        except Exception as exc:
            if attempt == 0:
                logger.warning("Vertex AI call failed attempt=1, retrying: %s", exc)
                time.sleep(0.5)
                continue
            logger.error("Vertex AI call failed after 2 attempts: %s", exc)
            return None


# ─── extract_fields tool (registered on rfq_generation_agent) ────────────────

def _extract_fields(conversation_json: str, fields_json: str) -> str:
    system = (
        "You are a data extraction assistant. Extract structured fields from a "
        "buyer-supplier conversation. Return ONLY valid JSON, no markdown fences. "
        "Return null for any field not clearly mentioned."
    )
    prompt = (
        f"Fields to extract: {fields_json}\n\n"
        f"Conversation:\n{conversation_json}\n\n"
        "Return a JSON object with exactly the listed field names as keys."
    )
    result = _call_vertex(system, prompt, max_tokens=2000)
    return result or "{}"


def extract_required_fields(messages: list[dict], required_fields: list[str]) -> dict:
    system = (
        "You extract RFQ intake fields from a buyer-assistant conversation. "
        "Return ONLY valid JSON with exactly the requested keys. "
        "If the buyer explicitly says they do not know or have no preference, "
        "use a short string such as 'Not specified' instead of null. "
        "Use null only when the field has not been answered yet."
    )
    prompt = (
        f"Required fields: {json.dumps(required_fields)}\n\n"
        f"Conversation:\n{json.dumps(messages)}\n\n"
        "Return a JSON object with exactly those keys."
    )
    result = _call_vertex(system, prompt, max_tokens=2000)
    parsed = _extract_json(result or "{}")
    return {field: parsed.get(field) for field in required_fields}


def get_missing_required_fields(extracted_fields: dict, required_fields: list[str]) -> list[str]:
    missing = []
    for field in required_fields:
        value = extracted_fields.get(field)
        if value is None:
            missing.append(field)
            continue
        if isinstance(value, str) and not value.strip():
            missing.append(field)
    return missing


extract_fields_tool = FunctionTool(_extract_fields)

# ─── ADK agents ──────────────────────────────────────────────────────────────

rfq_generation_agent = Agent(
    name="rfq_generation_agent",
    model=MODEL,
    description="Generates professional RFQ document text from extracted fields",
    instruction=(
        "You are a professional procurement writer. Generate a formal, well-structured Request for Quotation (RFQ) document in Markdown.\n\n"
        "RULES:\n"
        "- Use ONLY the actual values provided — never invent data or use placeholders like [INSERT X].\n"
        "- Format using Markdown: # for the title, ## for section headings, tables where appropriate, and bullet lists for deliverables.\n"
        "- Every section must contain real prose drawn from the supplied fields, not generic filler.\n\n"
        "REQUIRED SECTIONS (in order):\n"
        "1. # REQUEST FOR QUOTATION — include issuing organisation, category, and issue date\n"
        "2. ## 1. Issuing Organisation — one paragraph about the buyer\n"
        "3. ## 2. Purpose & Background — explain what is being procured and why\n"
        "4. ## 3. Scope of Work — list all deliverables as bullet points\n"
        "5. ## 4. Budget & Timeline — use a Markdown table with Budget Range and Expected Timeline rows\n"
        "6. ## 5. Vendor Requirements — minimum qualifications the supplier must meet\n"
        "7. ## 6. Response Instructions — numbered list of what vendors must include in their proposal\n"
        "8. ## 7. Evaluation Criteria — Markdown table with Criterion and Weight columns\n"
        "9. ## 8. Submission — one paragraph on how and when to submit\n\n"
        "Target length: 500–800 words."
    ),
)

memo_agent = Agent(
    name="memo_agent",
    model=MODEL,
    description="Writes sourcing decision memo with award recommendation and risk analysis",
    instruction=(
        "You are a senior procurement analyst writing an internal sourcing decision memo. "
        "Use ONLY the data provided — never invent facts or scores. "
        "Output clean, professional Markdown following this exact structure:\n\n"
        "# Sourcing Decision Memo: [RFQ Title]\n\n"
        "## Executive Summary\n"
        "Two sentences: recommended supplier and the core reason.\n\n"
        "## Recommendation\n"
        "State one of: **AWARD**, **SHORTLIST** (if >1 strong finalist), or **NO AWARD** (if none qualify). "
        "Then name the supplier, their score, and justify referencing the top 2 criteria. "
        "If scoring and the qualitative evidence disagree, explicitly flag the discrepancy.\n\n"
        "## Supplier Evaluation\n"
        "A Markdown table: Supplier | Score | Price | Timeline | Key Strengths | Flags.\n"
        "Rank by score. Include all qualifying suppliers.\n\n"
        "## Eliminated Suppliers\n"
        "Bullet list with specific elimination reason. If none, write 'No suppliers were eliminated.'\n\n"
        "## Alignment with Buyer Intent\n"
        "1–2 sentences on how well the recommended supplier addresses the buyer's stated priorities "
        "(not just formal criteria). Flag any gaps between what the buyer asked for and what was offered.\n\n"
        "## Risk Considerations\n"
        "2–3 bullets on delivery, compliance, and cost variance risks for the recommended supplier.\n\n"
        "## Uncertainty and What Would Change the Recommendation\n"
        "1–2 bullets: what additional information would strengthen confidence, or what scenario would "
        "flip the recommendation to the runner-up.\n\n"
        "## Recommended Next Steps\n"
        "3–4 numbered action items.\n\n"
        "Keep the entire memo under 550 words. Use plain Markdown — no HTML."
    ),
)

_session_service = InMemorySessionService()

_generation_runner = Runner(
    agent=rfq_generation_agent,
    session_service=_session_service,
    app_name="quoteflow",
)
_memo_runner = Runner(
    agent=memo_agent,
    session_service=_session_service,
    app_name="quoteflow",
)

# ─── public API ──────────────────────────────────────────────────────────────

def identify_category(description: str) -> str:
    """Identify RFQ category from buyer's initial description."""
    categories = get_available_categories()
    system = (
        f"Return exactly one category ID from this list: {categories}. "
        "No explanation. No punctuation. Just the category ID string."
    )
    result = _call_vertex(system, description, max_tokens=20)
    if result:
        clean = result.strip().lower()
        if clean in categories:
            logger.info("identify_category → %s", clean)
            return clean
        logger.warning("identify_category returned unknown category %r, defaulting to professional_services", clean)
    return "professional_services"


async def _ensure_session(user_id: str, session_id: str) -> None:
    existing = await _session_service.get_session(
        app_name="quoteflow",
        user_id=user_id,
        session_id=session_id,
    )
    if existing is None:
        await _session_service.create_session(
            app_name="quoteflow",
            user_id=user_id,
            session_id=session_id,
        )


# ─── Agent 1: RFQ Creation Agent ─────────────────────────────────────────────

async def process_message(
    rfq_id: str,
    user_id: str,
    message: str,
    template: dict,
    fields_collected: dict,
) -> tuple[str, dict | None, str | None, str | None]:
    """
    RFQ creation agent — single Vertex AI call combining:
      - Next best question (prioritised by importance)
      - Field extraction from buyer message
      - Contradiction detection
      - Category suggestion if request has evolved

    Returns (assistant_message, updated_fields, contradiction_warning, category_suggestion).
    """
    required_fields = template.get("required_fields", [])
    missing = [f for f in required_fields if not fields_collected.get(f)]
    categories = get_available_categories()
    current_category = template.get("category_id", "professional_services")

    system = (
        "You are an expert procurement assistant helping a buyer create an RFQ.\n\n"
        "Your job each turn:\n"
        "1. Extract any field values the buyer just provided into updated_fields.\n"
        "2. Detect contradictions — e.g. a $5k budget but a 6-month engagement with 5 developers.\n"
        "3. If the buyer's actual need clearly belongs to a different category than current, suggest it.\n"
        "4. Pick the single most important missing field and ask ONE focused question about it.\n"
        "   Prioritise budget and timeline first, then deliverables, then qualifications.\n"
        "5. If all fields are collected, confirm and summarise — do not ask more questions.\n\n"
        "Return ONLY a valid JSON object — no markdown, no extra text — with these keys:\n"
        '  "assistant_message": string — next question or confirmation\n'
        '  "updated_fields": object — all fields collected including new ones (omit null/empty)\n'
        '  "missing_fields": array — field names from required_fields still not collected\n'
        '  "contradiction": string|null — specific contradiction found in the buyer\'s answers, or null\n'
        '  "category_suggestion": string|null — a better category ID if the request has clearly evolved, or null\n\n'
        "Rules:\n"
        "- contradiction must be a concrete, specific statement (not a vague concern)\n"
        "- category_suggestion must be one of the available category IDs or null\n"
        "- Do not suggest a category change unless confidence is high"
    )

    prompt = (
        f"Available categories: {json.dumps(categories)}\n"
        f"Current category: {current_category}\n"
        f"Required fields: {json.dumps(required_fields)}\n"
        f"Fields collected so far: {json.dumps(fields_collected)}\n"
        f"Still missing: {json.dumps(missing)}\n"
        f"Buyer message: {message}\n\n"
        "Respond with JSON only."
    )

    logger.info("process_message start rfq=%s missing=%d", rfq_id, len(missing))
    result = _call_vertex(system, prompt, max_tokens=900)
    if not result:
        logger.error("process_message Vertex AI returned nothing rfq=%s", rfq_id)
        return "Can you tell me more about your specific requirements?", None, None, None

    parsed = _extract_json(result)
    assistant_message = parsed.get("assistant_message") or "Can you tell me more about your requirements?"
    raw_fields = parsed.get("updated_fields") or {}
    clean_fields = {k: v for k, v in raw_fields.items() if v is not None and v != "" and v != "Not specified"}

    contradiction = parsed.get("contradiction") or None
    cat_suggestion = parsed.get("category_suggestion") or None
    if cat_suggestion == current_category or cat_suggestion not in categories:
        cat_suggestion = None

    logger.info(
        "process_message done rfq=%s collected=%d missing=%d contradiction=%s category_suggestion=%s",
        rfq_id, len(clean_fields), len(parsed.get("missing_fields") or []),
        bool(contradiction), cat_suggestion,
    )
    return assistant_message, clean_fields or None, contradiction, cat_suggestion


# ─── Agent 2: Supplier Sourcing Agent ────────────────────────────────────────

def rank_suppliers(
    rfq_requirements: dict,
    rfq_category: str,
    suppliers: list[dict],
) -> list[dict]:
    """
    Supplier sourcing agent — ranks suppliers by fit for this specific RFQ.

    Each supplier dict must include: supplier_id, name, categories, response_rate,
    total_invitations, total_responses, avg_response_days.

    Returns sorted list with fit_score, fit_reasoning, batch (1|2), recommended.
    """
    if not suppliers:
        return []

    req_summary = {
        k: rfq_requirements.get(k)
        for k in ["service_type", "budget_max", "timeline_weeks", "deliverables", "industry_experience_required"]
        if rfq_requirements.get(k)
    }

    system = (
        "You are a procurement specialist ranking suppliers for a specific RFQ.\n\n"
        "For each supplier return an object with:\n"
        '  "supplier_id": string — copied from input\n'
        '  "fit_score": float 0.0–1.0 — how well this supplier fits this RFQ\n'
        '  "fit_reasoning": string — 1–2 sentence explanation citing specific signals\n'
        '  "batch": int — 1 (invite first) or 2 (reserve if batch 1 non-response is high)\n'
        '  "recommended": bool — true if fit_score >= 0.70\n\n'
        "Scoring signals:\n"
        "- Category overlap: exact match = strong positive, related = mild positive, none = negative\n"
        "- Response rate: >70% strong, 40–70% neutral, <40% negative\n"
        "- Avg response days: <3 days strong, 3–7 neutral, >7 negative\n"
        "- Total engagements: more history = more reliable signal\n"
        "- Batch 1 = top 60% by combined fit; Batch 2 = remaining\n\n"
        "Return ONLY a JSON array. No markdown, no explanation outside the array."
    )

    prompt = (
        f"RFQ category: {rfq_category}\n"
        f"RFQ requirements: {json.dumps(req_summary)}\n\n"
        f"Suppliers to rank:\n{json.dumps(suppliers, indent=2)}\n\n"
        "Return a JSON array with one object per supplier."
    )

    logger.info("rank_suppliers called category=%s supplier_count=%d", rfq_category, len(suppliers))
    result = _call_vertex(system, prompt, max_tokens=2500)
    if not result:
        logger.error("rank_suppliers Vertex AI returned nothing")
        return [{"supplier_id": s["supplier_id"], "fit_score": 0.5, "fit_reasoning": "Unable to rank — AI unavailable", "batch": 1, "recommended": False} for s in suppliers]

    ranked = _extract_json_list(result)
    if not ranked:
        logger.error("rank_suppliers parse failed")
        return suppliers

    # Sort by fit_score descending
    ranked.sort(key=lambda x: x.get("fit_score", 0), reverse=True)
    logger.info("rank_suppliers done — top fit_score=%.2f", ranked[0].get("fit_score", 0) if ranked else 0)
    return ranked


# ─── Agent 3: Response Evaluation Agent ──────────────────────────────────────

def evaluate_responses(
    responses: list[dict],
    rfq_requirements: dict,
    rfq_title: str,
) -> list[dict]:
    """
    Response evaluation agent — reviews submitted supplier responses for:
      - Ambiguous answers
      - Missing evidence
      - Clarification questions to send back
      - Compliance failures vs strategic concerns

    Returns per-response evaluation list.
    """
    if not responses:
        return []

    system = (
        "You are a senior procurement analyst reviewing supplier responses to an RFQ.\n\n"
        "For each supplier response, return an evaluation object with:\n"
        '  "supplier_name": string\n'
        '  "ambiguous_fields": list[string] — answers that are unclear or open to interpretation\n'
        '  "missing_evidence": list[string] — required information not provided\n'
        '  "clarification_questions": list[string] — 1–3 targeted questions to send back to the supplier\n'
        '  "compliance_failures": list[string] — hard violations (budget exceeded, deadline missed, mandatory cert absent)\n'
        '  "strategic_concerns": list[string] — qualitative risks not captured by compliance (team experience, vague approach, etc.)\n'
        '  "evaluation_summary": string — 2–3 sentence overall assessment\n\n'
        "Rules:\n"
        "- Be specific, not generic. Name the field and the issue.\n"
        "- Separate compliance failures (objective pass/fail) from strategic concerns (judgment calls).\n"
        "- Clarification questions should be answerable by the supplier in 1–2 sentences.\n"
        "- Return ONLY a JSON array. No markdown outside the array."
    )

    prompt = (
        f"RFQ: {rfq_title}\n"
        f"RFQ requirements: {json.dumps(rfq_requirements, indent=2)}\n\n"
        f"Supplier responses:\n{json.dumps(responses, indent=2)}\n\n"
        "Return a JSON array with one evaluation object per supplier."
    )

    logger.info("evaluate_responses called response_count=%d rfq=%s", len(responses), rfq_title)
    result = _call_vertex(system, prompt, max_tokens=3000)
    if not result:
        logger.error("evaluate_responses Vertex AI returned nothing")
        return []

    evaluations = _extract_json_list(result)
    logger.info("evaluate_responses done count=%d", len(evaluations))
    return evaluations


# ─── Field labels and core fields ─────────────────────────────────────────────

_FIELD_LABELS = {
    "service_type": "Service Type",
    "budget_min": "Minimum Budget (USD)",
    "budget_max": "Maximum Budget (USD)",
    "timeline_weeks": "Timeline (weeks)",
    "deliverables": "Deliverables",
    "industry_experience_required": "Industry Experience Required",
    "nda_required": "NDA Required",
    "team_size_preference": "Team Size Preference",
    "location_requirement": "Location Requirement",
    "contract_type": "Contract Type",
    "compliance_requirements": "Compliance Requirements",
}

_CORE_FIELDS = {"service_type", "budget_min", "budget_max", "timeline_weeks", "deliverables"}


def build_rfq_document(fields: dict, template: dict, org_name: str) -> str:
    """Public alias — builds RFQ deterministically with no LLM call."""
    return _build_rfq_fallback(fields, template, org_name)


def _build_rfq_fallback(fields: dict, template: dict, org_name: str) -> str:
    """Structured Markdown RFQ built deterministically from collected fields."""
    today = date.today().strftime("%B %d, %Y")
    category_name = template.get("category_name", "Services")

    service_type = fields.get("service_type") or category_name

    b_min = fields.get("budget_min")
    b_max = fields.get("budget_max")
    if b_min and b_max:
        budget_str = f"USD {int(b_min):,} – {int(b_max):,}"
    elif b_max:
        budget_str = f"Up to USD {int(b_max):,}"
    elif b_min:
        budget_str = f"From USD {int(b_min):,}"
    else:
        budget_str = "To be confirmed"

    timeline = fields.get("timeline_weeks")
    timeline_str = f"{timeline} weeks" if timeline and timeline != "Not specified" else "To be confirmed"

    deliverables = fields.get("deliverables", [])
    if isinstance(deliverables, list):
        deliverables_md = "\n".join(f"- {d}" for d in deliverables if d)
    elif deliverables and deliverables != "Not specified":
        deliverables_md = f"- {deliverables}"
    else:
        deliverables_md = "- As described in vendor proposal"

    extra_rows = []
    for k, v in fields.items():
        if k in _CORE_FIELDS or not v or v == "Not specified":
            continue
        label = _FIELD_LABELS.get(k, k.replace("_", " ").title())
        extra_rows.append(f"| {label} | {v} |")

    extra_section = ""
    if extra_rows:
        extra_section = (
            "\n\n### Additional Requirements\n\n"
            "| Requirement | Detail |\n"
            "|-------------|--------|\n"
            + "\n".join(extra_rows)
        )

    criteria = template.get("default_evaluation_criteria") or [
        {"label": "Proposed Approach & Methodology", "weight": 0.30},
        {"label": "Total Price", "weight": 0.25},
        {"label": "Relevant Experience", "weight": 0.25},
        {"label": "Delivery Timeline", "weight": 0.10},
        {"label": "Team Quality", "weight": 0.10},
    ]
    criteria_rows = "\n".join(
        f"| {c.get('label', c.get('name', ''))} | {int(c['weight'] * 100)}% |"
        for c in criteria
    )

    return f"""# REQUEST FOR QUOTATION

**Issuing Organisation:** {org_name}
**Category:** {category_name}
**Issue Date:** {today}

---

## 1. Issuing Organisation

{org_name} is issuing this Request for Quotation to identify and engage a qualified vendor to deliver **{service_type}**. We invite eligible suppliers to submit a comprehensive proposal covering their approach, pricing, team, and timeline.

---

## 2. Purpose & Background

{org_name} requires **{service_type}** and is conducting a competitive sourcing process to select the most suitable vendor. This RFQ outlines the scope, requirements, and evaluation criteria that will guide our selection.

---

## 3. Scope of Work

The selected vendor will be responsible for delivering the following:

{deliverables_md}
{extra_section}

---

## 4. Budget & Timeline

| Item | Detail |
|------|--------|
| Budget Range | {budget_str} |
| Expected Timeline | {timeline_str} |

All proposals must fall within the stated budget range. Proposals exceeding the maximum budget will be disqualified.

---

## 5. Vendor Requirements

Vendors submitting proposals must demonstrate:

- Proven track record delivering **{service_type}**
- Relevant case studies or references from comparable engagements
- A dedicated team with named leads and clearly defined responsibilities
- Capacity to commence work within the stated timeline
- Willingness to sign a Non-Disclosure Agreement if required

---

## 6. Response Instructions

Your proposal must address each of the following sections:

1. **Executive Summary** – A concise overview of your proposed solution
2. **Proposed Approach & Methodology** – Detailed project plan, phases, and key milestones
3. **Deliverables & Acceptance Criteria** – How each deliverable will be completed and verified
4. **Itemised Pricing** – Full cost breakdown aligned with the budget range stated above
5. **Delivery Timeline** – Milestone schedule with start date and completion date
6. **Team Credentials** – CVs or profiles of all personnel assigned to this engagement
7. **Relevant Experience** – Minimum 2–3 case studies from comparable projects
8. **References** – Contact details for at least two client references

---

## 7. Evaluation Criteria

Proposals will be scored against the following weighted criteria:

| Criterion | Weight |
|-----------|--------|
{criteria_rows}

---

## 8. Submission

Please submit your proposal in full response to this document. Incomplete proposals may be disqualified. All submissions are treated as confidential and used solely for evaluation purposes.

*This RFQ does not constitute a commitment to award a contract. {org_name} reserves the right to accept or reject any proposal at its discretion.*
"""


async def generate_rfq_document(fields: dict, template: dict, org_name: str) -> str:
    """Generate the full RFQ document text via the rfq_generation_agent."""
    prompt = (
        f"Organisation: {org_name}\n"
        f"Category: {template.get('category_name')}\n"
        f"Collected requirements:\n{json.dumps(fields, indent=2)}\n\n"
        "Generate the complete RFQ document now."
    )
    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=prompt)],
    )
    session_id = f"rfq_gen_{id(fields)}"
    result = ""
    try:
        await _ensure_session("system", session_id)
        async for event in _generation_runner.run_async(
            user_id="system",
            session_id=session_id,
            new_message=content,
        ):
            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        result += part.text
    except Exception as exc:
        logger.error("RFQ generation agent error: %s", exc)

    if not result:
        result = _build_rfq_fallback(fields, template, org_name)

    return result


# ─── Agent 4: Decision Support Agent ─────────────────────────────────────────

async def generate_decision_memo(
    rfq_title: str,
    scores: list[dict],
    eliminated: list[dict],
    criteria: list[dict],
    buyer_intent: str = "",
) -> str:
    """
    Decision support agent — generates sourcing decision memo with:
      - Explicit AWARD / SHORTLIST / NO AWARD recommendation
      - Alignment check against buyer's true intent
      - Scoring vs narrative disagreement detection
      - Uncertainty analysis and what would change the recommendation
    """
    intent_section = f"\nBuyer's stated intent (from intake conversation):\n{buyer_intent}\n" if buyer_intent else ""

    prompt = (
        f"RFQ: {rfq_title}\n"
        f"{intent_section}\n"
        f"Evaluation criteria (weights):\n{json.dumps(criteria, indent=2)}\n\n"
        f"Qualifying suppliers (ranked by score):\n{json.dumps(scores, indent=2)}\n\n"
        f"Eliminated suppliers:\n{json.dumps(eliminated, indent=2)}\n\n"
        "Write the sourcing decision memo now."
    )
    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=prompt)],
    )
    session_id = f"memo_{id(scores)}"
    result = ""
    try:
        await _ensure_session("system", session_id)
        async for event in _memo_runner.run_async(
            user_id="system",
            session_id=session_id,
            new_message=content,
        ):
            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        result += part.text
    except Exception as exc:
        logger.error("Memo agent error: %s", exc)

    if not result:
        lines = [f"SOURCING DECISION MEMO — {rfq_title}\n"]
        if scores:
            lines.append(f"RECOMMENDATION: AWARD — {scores[0].get('supplier_name')} (score: {scores[0].get('score')})")
        for e in eliminated:
            lines.append(f"ELIMINATED: {e.get('supplier_name')} — {e.get('elimination_reason')}")
        return "\n".join(lines)

    return result
