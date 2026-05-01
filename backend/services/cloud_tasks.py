import json
import logging
from google.cloud import tasks_v2
from config import settings

logger = logging.getLogger(__name__)


def create_task(task_name: str, payload: dict, delay_seconds: int = 0) -> None:
    """Enqueue a Cloud Tasks HTTP task to /internal/tasks/{task_name}."""
    try:
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
