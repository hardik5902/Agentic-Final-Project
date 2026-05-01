import json
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent
AVAILABLE_CATEGORIES = ["professional_services", "saas_tools", "marketing_agencies"]


def load_template(category_id: str) -> dict:
    path = TEMPLATES_DIR / f"{category_id}.json"
    if not path.exists():
        path = TEMPLATES_DIR / "professional_services.json"
    with open(path) as f:
        return json.load(f)


def get_available_categories() -> list[str]:
    return AVAILABLE_CATEGORIES
