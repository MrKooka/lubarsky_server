# app/services/celery_state_service.py
from celery import current_app
from app.services.logging_service import setup_logger

logger = setup_logger("app.services.celery_state_service")

def update_celery_task_state(task_id: str, state: str, meta: dict):
    """
    Обновляет состояние задачи Celery по её task_id,
    используя backend.store_result (не через task.update_state!).
    """
    try:
        current_app.backend.store_result(
            task_id=task_id,    # строка
            result=meta,        # что пишем в result
            state=state
        )
    except Exception as exc:
        logger.error(
            f"Failed to store_result for task_id={task_id}. Error: {exc}. "
            f"State={state}, meta={meta}"
        )
        # Тут нету простого retry, т.к. у нас только task_id, а не объект задачи.
        # Можно просто логировать или выбросить исключение.
        raise
