#./app/services/progress_logging_service.py
import os
import uuid
import logging
from celery.utils.log import get_task_logger

def setup_ytdlp_logger_for_task(
    task_id: str = None,
    log_dir: str = "/app/convertorData/logs",
    prefix: str = "download"
) -> tuple[logging.Logger, str]:
    """
    Создаёт и настраивает отдельный logger для yt_dlp, 
    который пишет в уникальный лог-файл на основе task_id.  
    :param task_id: Идентификатор задачи. Если не задан, генерируется uuid4.
    :param log_dir: Папка для лог-файлов (по умолчанию "/app/convertorData/logs").
    :param prefix: Префикс в названии лог-файла ("download" по умолчанию).
    :return: (ytdlp_logger, log_file_path).
    """
    # 1. Генерируем task_id, если не передали
    if not task_id:
        task_id = uuid.uuid4().hex

    # 2. Гарантируем, что каталог для логов существует
    os.makedirs(log_dir, exist_ok=True)

    # 3. Формируем путь к лог‑файлу
    log_file = os.path.join(log_dir, f"{prefix}_{task_id}.log")

    # 4. Для наглядности выводим, куда будем писать логи
    base_logger = get_task_logger(__name__)
    base_logger.info(f"Setting up ytdlp logger for task_id={task_id}. Log file: {log_file}")

    # 5. Создаём отдельный logger для yt_dlp
    ytdlp_logger = logging.getLogger(f"ytdlp_{task_id}")
    ytdlp_logger.setLevel(logging.DEBUG)

    # 6. Настраиваем FileHandler
    file_handler = logging.FileHandler(log_file, mode='w', encoding='utf-8')
    fmt = logging.Formatter('[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s')
    file_handler.setFormatter(fmt)

    # 7. Очищаем старые хендлеры и добавляем новый
    if ytdlp_logger.handlers:
        ytdlp_logger.handlers.clear()
    ytdlp_logger.addHandler(file_handler)

    return ytdlp_logger, log_file
