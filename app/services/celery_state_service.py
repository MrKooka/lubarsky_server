# app/services/celery_state_service.py
from app.services.logging_service import setup_logger

logger = setup_logger("app.services.celery_state_service")


def update_celery_task_state(task, state, meta):
    try:
        task.update_state(state=state, meta=meta)
    except Exception as exc:
        logger.error(f"failed to update celery task status tasl.request: {task.request} task.name: {task.name}")
        raise task.retry(exc=exc, countdown=60)