from datetime import timedelta
from google.cloud import storage
from config import settings

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "video/mp4",
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB


def _client() -> storage.Client:
    return storage.Client()


def upload_bytes(content: bytes, gcs_path: str, content_type: str) -> str:
    client = _client()
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    blob.upload_from_string(content, content_type=content_type)
    return gcs_path


def get_signed_url(gcs_path: str, expiry_hours: int = 1) -> str:
    client = _client()
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    return blob.generate_signed_url(
        expiration=timedelta(hours=expiry_hours),
        method="GET",
    )


def get_signed_upload_url(gcs_path: str, content_type: str, expiry_minutes: int = 15) -> str:
    client = _client()
    bucket = client.bucket(settings.GCS_BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    return blob.generate_signed_url(
        expiration=timedelta(minutes=expiry_minutes),
        method="PUT",
        content_type=content_type,
    )


def validate_file(content_type: str, size_bytes: int) -> None:
    from fastapi import HTTPException
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, f"File type not allowed: {content_type}")
    if size_bytes > MAX_FILE_SIZE:
        raise HTTPException(400, "File exceeds 25MB limit")
