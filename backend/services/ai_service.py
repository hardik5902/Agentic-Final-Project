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

import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool
from google.genai import types as genai_types

from config import settings
from templates.loader import get_available_categories

logger = logging.getLogger(__name__)

MODEL = "gemini-2.0-flash"

# Initialise Vertex AI once at module load — auth via ambient GCP credentials
vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_REGION)

# ─── helpers ─────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    clean = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        logger.error("Failed to parse AI JSON output: %s", clean[:200])
        return {}


def _call_vertex(system: str, prompt: str, max_tokens: int = 1500) -> str | None:
    """Single-turn Vertex AI call with one retry."""
    model = GenerativeModel(MODEL, system_instruction=system)
    for attempt in range(2):
        try:
            response = model.generate_content(
                prompt,
                generation_config=GenerationConfig(max_output_tokens=max_tokens),
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
    result = _call_vertex(system, prompt, max_tokens=800)
    return result or "{}"


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
        "You are a professional procurement writer. Generate a formal Request for Quotation "
        "document. Use ONLY the actual values provided — no placeholders like [INSERT X]. "
        "Required sections: Company Overview, Project Description, Scope of Work, "
        "Timeline and Budget, Vendor Qualifications, Response Instructions, Evaluation Criteria. "
        "Target length: 400-700 words."
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
        async for event in _conversation_runner.run_async(
            user_id=user_id,
            session_id=rfq_id,
            new_message=content,
        ):
            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        final_text += part.text
            # Detect tool result from extract_fields
            if hasattr(event, "tool_result") and event.tool_result:
                raw = event.tool_result.get("output", "{}")
                parsed = _extract_json(raw if isinstance(raw, str) else json.dumps(raw))
                if parsed:
                    extracted_fields = parsed
    except Exception as exc:
        logger.error("ADK conversation runner error for rfq %s: %s", rfq_id, exc)
        return "Can you tell me more about your specific requirements?", None

    return final_text or "Can you tell me more about your specific requirements?", extracted_fields


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
        # Graceful fallback — minimal document
        lines = [f"REQUEST FOR QUOTATION\n\nIssued by: {org_name}"]
        for k, v in fields.items():
            lines.append(f"- {k}: {v}")
        return "\n".join(lines)

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
