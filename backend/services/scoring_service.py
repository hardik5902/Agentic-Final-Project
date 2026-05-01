"""
Pure deterministic Python scoring — no AI.
Auditable weighted arithmetic.
"""


def score_suppliers(responses: list[dict], criteria: list[dict], buyer_ratings: dict) -> list[dict]:
    """
    responses: list of response row dicts (with normalized_data, eliminated, id)
    criteria: [{name, weight, type: calculated|buyer_rated}]
    buyer_ratings: {str(response_id): {criterion_name: 1-5}}
    Returns qualifying responses sorted by score descending, with score and score_breakdown set.
    """
    qualifying = [r for r in responses if not r.get("eliminated")]
    if not qualifying:
        return []

    prices = [r["normalized_data"].get("effective_total_cost", 0) for r in qualifying]
    timelines = [r["normalized_data"].get("timeline_weeks", 0) for r in qualifying]
    best_price = min(prices) if any(p > 0 for p in prices) else 1
    best_timeline = min(t for t in timelines if t > 0) if any(t > 0 for t in timelines) else 1

    for response in qualifying:
        nd = response["normalized_data"]
        score = 0.0
        breakdown = {}

        for criterion in criteria:
            name = criterion["name"]
            weight = criterion["weight"]

            if criterion["type"] == "calculated":
                if name == "price":
                    supplier_price = nd.get("effective_total_cost") or 1
                    raw = (best_price / supplier_price) * 100
                elif name == "timeline":
                    supplier_timeline = nd.get("timeline_weeks") or 1
                    raw = (best_timeline / supplier_timeline) * 100
                else:
                    raw = 50.0
            else:
                rating = buyer_ratings.get(str(response["id"]), {}).get(name, 0)
                raw = (rating / 5) * 100 if rating else 0.0

            weighted = round(raw * weight, 1)
            score += weighted
            breakdown[name] = {
                "raw_score": round(raw, 1),
                "weight": weight,
                "weighted_score": weighted,
            }

        response["score"] = round(score, 1)
        response["score_breakdown"] = breakdown

    return sorted(qualifying, key=lambda r: r["score"], reverse=True)
