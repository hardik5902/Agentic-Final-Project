import json
import logging
from config import settings

logger = logging.getLogger(__name__)


def _is_local() -> bool:
    return settings.API_BASE_URL.startswith("http://localhost")


def create_task(task_name: str, payload: dict, delay_seconds: int = 0) -> None:
    """Enqueue a Cloud Tasks HTTP task to /internal/tasks/{task_name}.
    In local dev, calls the endpoint directly via httpx instead of Cloud Tasks.
    """
    if _is_local():
        _call_local(task_name, payload)
        return

    try:
        from google.cloud import tasks_v2
        client = tasks_v2.CloudTasksClient()
        queue_path = client.queue_path(
            settings.GCP_PROJECT_ID,
            settings.GCP_REGION,
            "quoteflow-tasks",
        )
        task: dict = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": f"{settings.API_BASE_URL}/internal/tasks/{task_name}",
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(payload).encode(),
                "oidc_token": {
                    "service_account_email": settings.SERVICE_ACCOUNT_EMAIL,
                    "audience": settings.API_BASE_URL,
                },
            }
        }
        if delay_seconds > 0:
            import time
            from google.protobuf import timestamp_pb2
            eta = timestamp_pb2.Timestamp()
            eta.FromSeconds(int(time.time()) + delay_seconds)
            task["schedule_time"] = eta

        client.create_task(request={"parent": queue_path, "task": task})
    except Exception as exc:
        logger.error("Cloud Tasks enqueue failed for %s: %s", task_name, exc)
        if _is_local():
            _call_local(task_name, payload)


def _call_local(task_name: str, payload: dict) -> None:
    """Call the internal task endpoint directly (local dev only)."""
    import threading
    import httpx

    def _run():
        try:
            httpx.post(
                f"{settings.API_BASE_URL}/internal/tasks/{task_name}",
                json=payload,
                timeout=30,
            )
        except Exception as exc:
            logger.error("Local task call failed for %s: %s", task_name, exc)

    # Run in a background thread so it doesn't block the request
    threading.Thread(target=_run, daemon=True).start()
