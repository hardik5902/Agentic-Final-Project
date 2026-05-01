"""
Deterministic normalization pipeline — no AI.
Takes raw_data dict and requirements dict, returns (normalized_data, flags).
"""

import logging
from datetime import date

import httpx
import redis

from config import settings

logger = logging.getLogger(__name__)

UNIT_TO_WEEKS = {
    "days": 1 / 7,
    "day": 1 / 7,
    "weeks": 1,
    "week": 1,
    "months": 30 / 7,
    "month": 30 / 7,
    "business days": 1.4 / 7,
    "business day": 1.4 / 7,
    "working days": 1.4 / 7,
}

FREIGHT_PER_UNIT_USD = {
    "CN": 0.18, "MX": 0.08, "IN": 0.22, "DE": 0.12,
    "GB": 0.14, "JP": 0.16, "KR": 0.17, "VN": 0.20,
    "US": 0.02, "CA": 0.04,
}
DEFAULT_FREIGHT = 0.15
DDP_INCOTERMS = {"DDP", "DAP", "CIF", "CFR", "CPT"}


def _redis() -> redis.Redis:
    return redis.from_url(settings.REDIS_URL)


def _fetch_exchange_rate(from_currency: str) -> float:
    """Fetch USD exchange rate, cache in Redis for 24h."""
    r = _redis()
    key = f"exchange_rate:{from_currency}:USD:{date.today()}"
    cached = r.get(key)
    if cached:
        return float(cached)

    try:
        url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
        resp = httpx.get(url, timeout=5)
        rate = resp.json()["rates"]["USD"]
        r.setex(key, 86400, str(rate))
        return float(rate)
    except Exception as exc:
        logger.error("Exchange rate fetch failed: %s", exc)
        return 1.0  # fallback: assume 1:1


def _to_usd(amount: float, currency: str) -> tuple[float, float]:
    """Return (amount_usd, rate_used)."""
    if currency.upper() == "USD":
        return round(amount, 2), 1.0
    rate = _fetch_exchange_rate(currency.upper())
    return round(amount * rate, 2), rate


def _to_weeks(value: float, unit: str) -> float:
    multiplier = UNIT_TO_WEEKS.get(unit.lower().strip(), 1)
    return round(value * multiplier, 1)


def _make_flag(flag_type: str, field: str, message: str, eliminates: bool) -> dict:
    return {"type": flag_type, "field": field, "message": message, "eliminates": eliminates}


def normalize(raw_data: dict, requirements: dict, template: dict) -> tuple[dict, list]:
    """
    Run the full normalization pipeline.
    Returns (normalized_data, flags).
    """
    nd: dict = {}
    flags: list = []

    # Step 1 — currency conversion
    price = float(raw_data.get("total_price") or raw_data.get("annual_cost") or 0)
    currency = raw_data.get("currency", "USD")
    price_usd, rate = _to_usd(price, currency)
    nd["total_price_usd"] = price_usd
    nd["original_currency"] = currency
    nd["exchange_rate_used"] = rate

    # Step 2 — lead time standardization
    timeline_value = float(raw_data.get("timeline_value") or raw_data.get("implementation_weeks") or 0)
    timeline_unit = raw_data.get("timeline_unit", "weeks")
    timeline_weeks = _to_weeks(timeline_value, timeline_unit)
    nd["timeline_weeks"] = timeline_weeks
    nd["timeline_days"] = round(timeline_weeks * 7)

    # Step 3 — landed cost (services have no freight)
    nd["freight_per_unit_usd"] = 0.0
    nd["landed_cost_per_unit_usd"] = price_usd
    nd["landed_cost_total_usd"] = price_usd

    # Step 4 — revision cost normalization (marketing only)
    min_revisions = requirements.get("revision_rounds_min", 0)
    included = int(raw_data.get("revision_rounds_included") or 0)
    additional_cost = float(raw_data.get("additional_revision_cost") or 0)
    if min_revisions and included < min_revisions:
        shortfall = min_revisions - included
        effective_revision_cost = shortfall * additional_cost
    else:
        effective_revision_cost = 0.0
    nd["revision_rounds_included"] = included
    nd["effective_revision_cost"] = round(effective_revision_cost, 2)

    # Step 5 — effective total cost
    nd["effective_total_cost"] = round(nd["landed_cost_total_usd"] + effective_revision_cost, 2)

    # Portfolio links passthrough
    nd["portfolio_links"] = raw_data.get("portfolio_links", [])

    # Step 6 — compliance flags
    budget_max = requirements.get("budget_max")
    if budget_max and nd["effective_total_cost"] > float(budget_max):
        flags.append(_make_flag(
            "hard_elimination", "price",
            f"Total cost ${nd['effective_total_cost']:,.0f} exceeds maximum budget ${budget_max:,.0f}",
            eliminates=True,
        ))

    timeline_max = requirements.get("timeline_weeks") or requirements.get("implementation_timeline_weeks")
    if timeline_max and nd["timeline_weeks"] > float(timeline_max):
        flags.append(_make_flag(
            "hard_elimination", "timeline",
            f"Timeline {nd['timeline_weeks']:.1f} weeks exceeds {timeline_max} week requirement",
            eliminates=True,
        ))

    # Portfolio minimum (soft warning)
    min_portfolio = next(
        (f.get("min_count") for f in template.get("response_form_fields", [])
         if f.get("field_id") == "portfolio_links"),
        None,
    )
    if min_portfolio and len(nd["portfolio_links"]) < min_portfolio:
        flags.append(_make_flag(
            "warning", "portfolio_links",
            f"Only {len(nd['portfolio_links'])} portfolio link(s) provided, {min_portfolio} requested",
            eliminates=False,
        ))

    return nd, flags
