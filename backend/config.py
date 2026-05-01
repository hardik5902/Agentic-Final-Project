import os
from functools import lru_cache
from pydantic_settings import BaseSettings


def _get_secret(name: str) -> str | None:
    """Fetch from GCP Secret Manager; fall back to env var for local dev."""
    env_val = os.environ.get(name)
    if env_val:
        return env_val
    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        project_id = os.environ.get("GCP_PROJECT_ID", "")
        if not project_id:
            return None
        secret_name = f"projects/{project_id}/secrets/{name}/versions/latest"
        response = client.access_secret_version(request={"name": secret_name})
        return response.payload.data.decode("UTF-8")
    except Exception:
        return None


class Settings(BaseSettings):
    # GCP
    GCP_PROJECT_ID: str = os.environ.get("GCP_PROJECT_ID", "quoteflow-dev")
    GCP_REGION: str = os.environ.get("GCP_REGION", "us-east5")
    GCS_BUCKET_NAME: str = os.environ.get("GCS_BUCKET_NAME", "quoteflow-dev-files")
    SERVICE_ACCOUNT_EMAIL: str = os.environ.get(
        "SERVICE_ACCOUNT_EMAIL",
        "quoteflow-api@quoteflow-dev.iam.gserviceaccount.com"
    )

    # Database
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "postgresql://quoteflow:localpassword@localhost:5432/quoteflow"
    )

    # Redis
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")

    # JWT
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-change-in-prod")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # SendGrid
    SENDGRID_API_KEY: str = os.environ.get("SENDGRID_API_KEY", "")
    EMAIL_FROM: str = "rfq@quoteflow.com"

    # Exchange rate API
    EXCHANGE_RATE_API_KEY: str = os.environ.get("EXCHANGE_RATE_API_KEY", "")

    # URLs
    API_BASE_URL: str = os.environ.get("API_BASE_URL", "http://localhost:8080")
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    SUPPLIER_PORTAL_URL: str = os.environ.get("SUPPLIER_PORTAL_URL", "http://localhost:3001")

    # Sentry
    SENTRY_DSN: str = os.environ.get("SENTRY_DSN", "")

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
