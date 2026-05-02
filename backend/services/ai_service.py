"""
AI service — Google ADK (agentic orchestration) + Vertex AI gemini-2.0-flash (LLM).

Three ADK agents:
  rfq_conversation_agent  — multi-turn clarifying question loop
  rfq_generation_agent    — single-turn RFQ document generation
  memo_agent              — single-turn decision memo generation

Direct Vertex AI calls (no ADK) for single-classification tasks:
  identify_category
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

_genai_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(
            vertexai=True,
            project=settings.GCP_PROJECT_ID,
            location=settings.GCP_REGION,
        )
    return _genai_client

# ─── helpers ─────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    clean = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        logger.error("Failed to parse AI JSON output: %s", clean[:200])
        return {}


def _parse_tool_payload(raw: object) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        if "output" in raw:
            return _parse_tool_payload(raw["output"])
        if "result" in raw:
            return _parse_tool_payload(raw["result"])
        return raw
    if isinstance(raw, str):
        return _extract_json(raw)
    return _extract_json(json.dumps(raw))


def _call_vertex(system: str, prompt: str, max_tokens: int = 1500) -> str | None:
    """Single-turn Vertex AI call with one retry."""
    client = _get_client()
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=max_tokens,
                ),
            )
            return response.text
        except Exception as exc:
            if attempt == 0:
                time.sleep(2)
                continue
            logger.error("Vertex AI call failed after 2 attempts: %s", exc)
            return None


# ─── extract_fields tool (registered on conversation agent) ──────────────────

def _extract_fields(conversation_json: str, fields_json: str) -> str:
    """
    Extract structured fields from conversation history.
    Called by the rfq_conversation_agent when all required fields are collected.
    Returns JSON string of extracted fields.
    """
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
    """Extract the current best-known values for required RFQ fields."""
    system = (
        "You extract RFQ intake fields from a buyer-assistant conversation. "
        "Return ONLY valid JSON with exactly the requested keys. "
        "If the buyer explicitly says they do not know, have no preference, or want the vendor to propose it, "
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

_CONVERSATION_SYSTEM = """You are an expert procurement assistant helping a buyer create a
Request for Quotation (RFQ). Your job is to ask ONE clarifying question at a time to gather
the required information. Be conversational and professional — not robotic.

When you have collected all required fields, call the extract_fields tool with:
- conversation_json: the full conversation as a JSON array
- fields_json: a JSON array of the required field names

Do NOT ask about fields that are not in the required_fields list.
Do NOT invent or assume values — ask the buyer.
"""

rfq_conversation_agent = Agent(
    name="rfq_conversation_agent",
    model=MODEL,
    description="Guides buyer through RFQ creation via clarifying questions",
    instruction=_CONVERSATION_SYSTEM,
    tools=[extract_fields_tool],
)

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
    description="Writes sourcing decision memo narrative from scored results",
    instruction=(
        "You are a procurement analyst. Write a sourcing decision memo using ONLY the data "
        "provided. Do not invent facts. Required sections: Recommendation, Eliminated Suppliers, "
        "Evaluation Summary, Risk Considerations, Recommended Next Steps. Target: 350-500 words."
    ),
)

_session_service = InMemorySessionService()

_conversation_runner = Runner(
    agent=rfq_conversation_agent,
    session_service=_session_service,
    app_name="quoteflow",
)
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
            return clean
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


async def process_message(
    rfq_id: str,
    user_id: str,
    message: str,
    template: dict,
    fields_collected: dict,
) -> tuple[str, dict | None]:
    """
    Send one buyer message through the conversation agent.
    Returns (response_text, extracted_fields_or_None).
    extracted_fields is set when the agent calls the extract_fields tool.
    """
    # Inject current template context into the first message of each session
    context_prefix = (
        f"[Context] Required fields: {json.dumps(template.get('required_fields', []))}. "
        f"Fields already collected: {json.dumps(fields_collected)}. "
        f"Category: {template.get('category_name', '')}.\n\n"
    )
    enriched_message = context_prefix + message

    content = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=enriched_message)],
    )

    final_text = ""
    extracted_fields: dict | None = None

    try:
        await _ensure_session(user_id, rfq_id)

        async for event in _conversation_runner.run_async(
            user_id=user_id,
            session_id=rfq_id,
            new_message=content,
        ):
            for function_response in event.get_function_responses():
                if function_response.name == "_extract_fields":
                    parsed = _parse_tool_payload(function_response.response)
                    if parsed:
                        extracted_fields = parsed

            # Some ADK/model combinations surface a terminal function_call without
            # the corresponding function_response. Execute the extraction locally
            # so the RFQ flow can still complete deterministically.
            for function_call in event.get_function_calls():
                if function_call.name == "_extract_fields":
                    args = function_call.args or {}
                    raw = _extract_fields(
                        args.get("conversation_json", "[]"),
                        args.get("fields_json", "[]"),
                    )
                    parsed = _extract_json(raw)
                    if parsed:
                        extracted_fields = parsed

            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        final_text += part.text
    except Exception as exc:
        logger.error("ADK conversation runner error for rfq %s: %s", rfq_id, exc)
        return "Can you tell me more about your specific requirements?", None

    return final_text or "Can you tell me more about your specific requirements?", extracted_fields


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


def _build_rfq_fallback(fields: dict, template: dict, org_name: str) -> str:
    """Structured Markdown RFQ built deterministically from collected fields."""
    today = date.today().strftime("%B %d, %Y")
    category_name = template.get("category_name", "Services")

    service_type = fields.get("service_type") or category_name

    # Budget
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

    # Timeline
    timeline = fields.get("timeline_weeks")
    timeline_str = f"{timeline} weeks" if timeline and timeline != "Not specified" else "To be confirmed"

    # Deliverables
    deliverables = fields.get("deliverables", [])
    if isinstance(deliverables, list):
        deliverables_md = "\n".join(f"- {d}" for d in deliverables if d)
    elif deliverables and deliverables != "Not specified":
        deliverables_md = f"- {deliverables}"
    else:
        deliverables_md = "- As described in vendor proposal"

    # Additional fields beyond the core set
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

    # Default evaluation criteria from template, or sensible defaults
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


async def generate_decision_memo(
    rfq_title: str,
    scores: list[dict],
    eliminated: list[dict],
    criteria: list[dict],
) -> str:
    """Generate the sourcing decision memo narrative via the memo_agent."""
    prompt = (
        f"RFQ: {rfq_title}\n\n"
        f"Evaluation criteria (weights):\n{json.dumps(criteria, indent=2)}\n\n"
        f"Qualifying suppliers (ranked):\n{json.dumps(scores, indent=2)}\n\n"
        f"Eliminated suppliers:\n{json.dumps(eliminated, indent=2)}\n\n"
        "Write the sourcing decision memo."
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
        # Graceful fallback — tabular summary
        lines = [f"SOURCING DECISION MEMO — {rfq_title}\n"]
        if scores:
            lines.append(f"RECOMMENDATION: {scores[0].get('supplier_name')} (score: {scores[0].get('score')})")
        for e in eliminated:
            lines.append(f"ELIMINATED: {e.get('supplier_name')} — {e.get('elimination_reason')}")
        return "\n".join(lines)

    return result
