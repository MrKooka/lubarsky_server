#./app/tasks.py
import re
import threading
import time
import uuid
from app.celery_app import celery 
from app.convertor import (
    compress_audio_extreme,
    get_file_size_mb,
    extract_video_fragment,
    download_audio,
    download_video
)
import os
import sys
from app.openai_service import transcribe_audio
import json
from app import SessionLocal,setup_logger
from app.models.models import Transcript
from app.services.transcript_service import update_transcript_status, create_or_update_transcript
from app.services.celery_state_service import update_celery_task_state
from app.services.database_service import get_session,create_or_update_download_fragment
from app.services.convertor_service import progress_hook,sanitize_filename
import yt_dlp
from celery.utils.log import get_task_logger
from app.services.progress_logging_service import setup_ytdlp_logger_for_task
from app.services.progress_service import print_progress_bar, tail_log_file,start_download
logger = setup_logger("app.tasker")


@celery.task(bind=True,name="app.tasks.transcribe_audio_task")
def transcribe_audio_task(self, download_result):
    logger.info("transcribe_audio_task started. Using hardcoded parameters.")
    audio_path = download_result["audio_file_path"]
    video_id  = download_result["videoId"]
    # session = SessionLocal()

    with get_session() as session:
        update_transcript_status(
            session=session,
            video_id=video_id,
            status="transcribing"
        )
        
    update_celery_task_state(
        task=self, 
        state="PROGRESS",
        meta={"step": "transcribing", "percent": 90},
    )

    raw_transcription = transcribe_audio(audio_path)

    words_list = []
    for w in raw_transcription.words:
        words_list.append({"start": w.start, "end": w.end, "word": w.word})
    

    try:
        with get_session() as session:
            create_or_update_transcript(session, video_id, raw_transcription.text, words_list)
    except Exception as e:
        logger.error(f"Failed to save transcript for video_id '{video_id}': {e}")
        raise

    # try:
    #     with get_session() as session:
    #         transcript = session.query(Transcript).filter_by(video_id=video_id).first()
    #         if not transcript:
    #             transcript = Transcript(video_id=video_id)
    #             session.add(transcript)
            
    #         transcript.transcript = raw_transcription.text
    #         transcript.raw_json = json.dumps(words_list, ensure_ascii=False)
    #         transcript.status = "done"
    #         session.commit()
    # except Exception as e:
    #     session.rollback()
    #     logger.error(f"Error saving transcript: {e}")
    #     raise
    # finally:
    #     session.close()
    
    update_celery_task_state(
        task=self, 
        state="SUCCESS",
        meta={"step": "done", "percent": 100},
    )

    return {"transcription":raw_transcription.text,"videoId":video_id}


# /app/tasks.py

@celery.task(bind=True, name="app.tasks.triger_download_audio")
def triger_download_audio(self, video_id, user_id: str):

    # 1. Основной логгер задач
    logger = get_task_logger(__name__)

    # 2. Генерация task_id и подготовка уникального лог-файла
    task_id = self.request.id or str(uuid.uuid4())
    log_dir = "/app/convertorData/logs/"
    ytdlp_logger, log_file = setup_ytdlp_logger_for_task(
        task_id=task_id,
        log_dir=log_dir
    )
    logger.info(f"Начинаем скачивание video_id={video_id}. Лог пишется в файл {log_file}.")

    # 3. Подготовка папки для скачивания
    download_path = os.path.join("/app/convertorData", user_id)
    os.makedirs(download_path, exist_ok=True)

    # 4. Настраиваем поток, который будет отслеживать прогресс по логу
    stop_event = threading.Event()
    main_task_id = self.request.id
    def update_progress_func(progress):
        """
        Колбек, вызываемый при каждом новом значении процента.
        Здесь можно как печатать прогресс-бар, так и обновлять celery state.
        """
        # print_progress_bar(progress)  # Для наглядности в консоли воркера (опционально)
        update_celery_task_state(
            task_id=main_task_id,
            state="PROGRESS",
            meta={"step": "downloading", "percent": int(progress)},
        )

    tail_thread = threading.Thread(
        target=tail_log_file,
        args=(log_file, stop_event, update_progress_func),
        daemon=True
    )
    tail_thread.start()

    session = SessionLocal()

    # 5. Для наглядности сразу поставим 0%
    update_celery_task_state(
        task_id=main_task_id, 
        state="PROGRESS",
        meta={"step": "downloading", "percent": 0} ,

    )

    with get_session() as sess:
        update_transcript_status(
            session=sess,
            video_id=video_id,
            status="downloading",

        )

    # 6. Получаем метаданные видео (чтобы вытащить title и т.д.)
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL({'quiet': True}) as ydl_temp:
        info = ydl_temp.extract_info(video_url, download=False)
    cleaned_title = sanitize_filename(info.get('title', 'video'))

    # 7. Скачиваем в try/except
    try:
        # Настройки для аудио-загрузки
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(download_path, f"{cleaned_title}.%(ext)s"),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            # 'progress_hooks': [progress_hook],  # Удаляем/комментируем, если не используете
            'prefer_ffmpeg': True,
            'keepvideo': False,
            'logger': ytdlp_logger,
            'quiet': True,
        }
        downloaded_file = download_audio(
            video_url,
            download_path,
            ydl_opts=ydl_opts
        )
    except Exception as e:
        logger.exception(f"Failed to download audio. Reason: {e}")
        try:
            with get_session() as session:
                transcript = session.query(Transcript).filter_by(video_id=video_id).first()
                if transcript:
                    transcript.update_status('error', session)
                    transcript.update_error(str(e), session)
        except Exception as e_inner:
            session.rollback()
            logger.error(f"Error updating status: {e_inner}")
            logger.error(f"Context: video_id: {video_id}")
        # Обязательно остановим tail-поток и удалим лог, прежде чем упадём
        stop_event.set()
        tail_thread.join()
        if os.path.exists(log_file):
            os.remove(log_file)
            logger.info(f"Удалили лог-файл: {log_file}")
        # Пробрасываем ошибку дальше, чтобы Celery зафиксировал FAILURE
        raise
    finally:
        session.close()

    # =========================
    # 8. Конверсия скачанного .mp3 в .ogg
    # =========================
    # logger.info("Hardcoded choice = 3 (convert to audio).")
    # chosen_format = 'ogg'
    # chosen_codec = 'libopus'   
    # is_lossless = False
    # use_vbr = True
    # logger.info("Hardcoded VBR for Opus = True.")
    # max_size_float = 25
    # logger.info("Hardcoded max_size = 25mb.")

    # update_celery_task_state(
    #     task_id=main_task_id,
    #     state="PROGRESS",
    #     meta={"step": "compress_audio", "percent": 50},
        
    # )

    # with get_session() as sess:
    #     update_transcript_status(
    #         session=sess,
    #         video_id=video_id,
    #         status="compress_audio",
            
    #     )

    # try:
    #     final_audio = compress_audio_extreme(
    #         input_file=downloaded_file,
    #         chosen_format=chosen_format,
    #         chosen_codec=chosen_codec,
    #         is_lossless=is_lossless,
    #         max_size_mb=max_size_float,
    #         initial_bitrate_kbps=96,
    #         min_bitrate_kbps=32,
    #         use_vbr=use_vbr,
    #     )
    #     if final_audio and os.path.exists(final_audio):
    #         final_size_mb = get_file_size_mb(final_audio)
    #         logger.info(
    #             f"Audio compressed successfully to: {final_audio} "
    #             f"({final_size_mb:.2f} MB)."
    #         )
    #     else:
    #         logger.info(
    #             "Audio compression did not produce a final file. "
    #             "Check the logs for details."
    #         )
    # except RuntimeError:
    #     logger.error("Audio conversion failed. Check log for details.")

    # 9. Завершаем задачу: останавливаем tail, удаляем лог
    logger.info("Script finished.")
    stop_event.set()
    tail_thread.join()

    if os.path.exists(log_file):
        os.remove(log_file)
        logger.info(f"Удалили лог-файл: {log_file}")

    # Можно поставить 100% (или SUCCESS) в Celery
    update_celery_task_state(
        task_id=main_task_id,
        state="PROGRESS",  # Или "SUCCESS". Но Celery автоматически после return станет "SUCCESS"
        meta={"step": "done", "percent": 100},
    )

    logger.info("All done!")
    return {
        "audio_file_path": os.path.abspath(downloaded_file),
        "videoId": video_id
    }

@celery.task(bind=True,name="app.tasks.download_and_extract_fragment")
def download_and_extract_fragment(self, video_url: str, start_time: str, end_time: str, user_id: str):
    """
    Celery‑задача для скачивания видео и вырезания фрагмента.
    Пишет прогресс в уникальный лог, парсит его в фоновом потоке,
    обновляет Celery-task state, возвращает путь к вырезанному фрагменту.
    """

    # 1. Основной логгер для сообщений задачи
    logger = get_task_logger(__name__)
    logger.info(f"[Task start] user_id={user_id}, video_url={video_url}")

    # 2. Генерация task_id и настройка отдельного logger для yt_dlp
    task_id = self.request.id or str(uuid.uuid4())
    log_dir = "/app/convertorData/logs"  
    ytdlp_logger, log_file = setup_ytdlp_logger_for_task(task_id=task_id, log_dir=log_dir)
    logger.info(f"Уникальный лог‑файл для yt_dlp: {log_file}")

    # 3. Настраиваем фоновый поток, который будет читать проценты из лога
    stop_event = threading.Event()

    def update_progress_func(progress):
        """Колбек, вызываемый при каждом новом значении процента (через tail_log_file)."""
        print_progress_bar(progress)  # Опционально: вывод прогресса в консоль (на воркере)
        update_celery_task_state(
            task=self,
            state="PROGRESS",
            meta={"step": "downloading", "percent": progress},
        )

    tail_thread = threading.Thread(
        target=tail_log_file,
        args=(log_file, stop_event, update_progress_func),
        daemon=True
    )
    tail_thread.start()

    # 4. Готовим директорию для хранения результатов
    download_path = os.path.join("/app/convertorData", user_id)
    os.makedirs(download_path, exist_ok=True)

    # 5. Генерация уникального имени для будущего фрагмента
    fragment_filename = f"fragment_{uuid.uuid4().hex}.mp4"
    fragment_filepath = os.path.join(download_path, fragment_filename)

    # 6. Получаем метаданные видео (чтобы вытащить title и т.д.)
    with yt_dlp.YoutubeDL({'quiet': True}) as ydl_temp:
        info = ydl_temp.extract_info(video_url, download=False)
    cleaned_title = sanitize_filename(info.get('title', 'video'))

    # 7. Попытка скачивания и вырезания фрагмента
    downloaded_video = None
    try:
        # Параметры для скачивания
        format_str = (
            'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/'
            'best[ext=mp4][height<=720]'
        )
        ydl_opts = {
            'format': format_str,
            'outtmpl': os.path.join(download_path, f"{cleaned_title}.%(ext)s"),
            'logger': ytdlp_logger,  # Запись именно в наш уникальный лог
            'quiet': True,
            # 'progress_hooks': [progress_hook],  # если не нужен — убираем
        }

        logger.info("Начинаем скачивание видео...")
        downloaded_video = download_video(
            video_url,
            download_path,
            ydl_opts=ydl_opts
        )
        logger.info(f"Видео скачано: {downloaded_video}")

        # Вырезаем фрагмент с помощью вашей функции
        logger.info(f"Вырезаем фрагмент c {start_time} до {end_time} в файл {fragment_filepath}")
        extract_video_fragment(downloaded_video, fragment_filepath, start_time, end_time)
        logger.info(f"Фрагмент готов: {fragment_filepath}")

        # Сохраняем в БД результат (при необходимости)
        with get_session() as session:
            create_or_update_download_fragment(
                session=session,
                user_id=user_id,
                video_url=video_url,
                start_time=start_time,
                end_time=end_time,
                fragment_path=fragment_filepath,
            )

        # (Опционально) Удаляем полное видео, если оно не нужно
        if downloaded_video and os.path.exists(downloaded_video):
            os.remove(downloaded_video)
            logger.info(f"Полное видео удалено: {downloaded_video}")

        logger.info("Задача download_and_extract_fragment завершена успешно.")
        return fragment_filepath

    except Exception as e:
        logger.error(f"Ошибка в download_and_extract_fragment: {e}")
        # Повторная попытка задачи (Celery)
        # NB: При необходимости вы можете убрать retry
        raise self.retry(exc=e, countdown=60, max_retries=3)

    finally:
        # 8. В любом случае (успех или ошибка) останавливаем tail и удаляем лог
        stop_event.set()
        tail_thread.join()

        if os.path.exists(log_file):
            os.remove(log_file)
            logger.info(f"Уникальный лог-файл удалён: {log_file}")

            


@celery.task(bind=True, name="app.tasks.download_video_task")
def download_video_task(self, video_url: str, format_id: str, user_id: str):
    """
    Скачивает видео в указанный формат_id (MP4) и возвращает путь к файлу.
    """

    logger = get_task_logger(__name__)
    task_id = self.request.id or str(uuid.uuid4())

    log_dir = "/app/convertorData/logs/"
    ytdlp_logger, log_file = setup_ytdlp_logger_for_task(task_id=task_id, log_dir=log_dir)

    # Настраиваем фоновый поток для чтения процентов из лога
    stop_event = threading.Event()
    def update_progress_func(progress):
        update_celery_task_state(
            task_id=task_id,
            state="PROGRESS",
            meta={"step": "downloading", "percent": int(progress)},
        )

    tail_thread = threading.Thread(
        target=tail_log_file,
        args=(log_file, stop_event, update_progress_func),
        daemon=True
    )
    tail_thread.start()

    download_path = os.path.join("/app/convertorData", user_id)
    os.makedirs(download_path, exist_ok=True)

    # Для наглядности ставим 0%
    update_celery_task_state(
        task_id=task_id,
        state="PROGRESS",
        meta={"step": "downloading", "percent": 0}
    )

    try:
        # Выдернем title (для имени файла)
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl_temp:
            info = ydl_temp.extract_info(video_url, download=False)
        cleaned_title = sanitize_filename(info.get('title', 'video'))


        # Тут важно: format_id — это полная строка (например '137' или '248').
        # Иногда нужно объединять video+audio, если видео и аудио разделены.
        # Но если format_id указывает на уже объединённый контейнер (mp4 с аудио),
        # тогда просто указываем:
        ydl_opts = {
            'format': format_id, 
            'outtmpl': os.path.join(download_path, f"{cleaned_title}_{format_id}.%(ext)s"),
            'logger': ytdlp_logger,
            'quiet': True,
            # 'progress_hooks': [progress_hook], # Либо полагаемся на лог-парсер
        }

        # Скачиваем
        downloaded_filepath = download_video(video_url, download_path, ydl_opts=ydl_opts)
        #  ^^^ ваша функция-обёртка, аналогично download_audio
        logger.info(f"Video downloaded: {downloaded_filepath}")

        # Очищаем хвост
        stop_event.set()
        tail_thread.join()

        if os.path.exists(log_file):
            os.remove(log_file)

        update_celery_task_state(
            task_id=task_id,
            state="SUCCESS",
            meta={
            "step": "done",
            "percent": 100,
            "file_path": downloaded_filepath,
            "video_url": video_url
            },
        )

        return None

    except Exception as e:
        logger.error(f"Ошибка при скачивании видео: {e}")

        stop_event.set()
        tail_thread.join()
        if os.path.exists(log_file):
            os.remove(log_file)

        raise  # Пробросить, чтобы Celery зафиксировал ошибку
