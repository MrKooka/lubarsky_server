#./app/tasks.py

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
        meta={"step": "transcribing", "percent": 90} 
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
        meta={"step": "done", "percent": 100} 
    )

    return {"transcription":raw_transcription.text,"videoId":video_id}


# /app/tasks.py

@celery.task(bind=True, name="app.tasks.triger_download")
def triger_download(self, video_id, user_id: str):
    logger.info("Script started. Using hardcoded parameters.")
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    download_path = os.path.join("/app/convertorData", user_id)
    os.makedirs(download_path, exist_ok=True)

    session = SessionLocal()

    update_celery_task_state(
        task=self, 
        state="PROGRESS",
        meta={"step": "downloading", "percent": 10} 
    )

    with get_session() as sess:
        update_transcript_status(
            session=sess,
            video_id=video_id,
            status="downloading"
        )

    with yt_dlp.YoutubeDL({'quiet': True}) as ydl_temp:
        info = ydl_temp.extract_info(video_url, download=False)
        
    cleaned_title = sanitize_filename(info.get('title', 'video'))
    try:
        
        ydl_opts = {
            'format': 'bestaudio/best',  # Выбирает лучшее доступное аудио качество
            'outtmpl': os.path.join(download_path, f"{cleaned_title}.%(ext)s"),  # Шаблон имени файла
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',  # Желательный кодек аудио (можно заменить на 'm4a', 'opus' и т.д.)
                'preferredquality': '192',  # Качество аудио в Kbps
            }],
            'progress_hooks': [progress_hook],
            'prefer_ffmpeg': True,  # Использовать ffmpeg для постобработки
            'keepvideo': False,  # Не сохранять исходное видео
        }
        downloaded_file = download_audio(video_url, download_path, ydl_opts=ydl_opts)
    except Exception as e:
        logger.exception(f"Failed to download audio. Reason: {e}")
        try:
            with get_session() as session:
                transcript = session.query(Transcript).filter_by(video_id=video_id).first()
                transcript.update_status('error', session)
                transcript.update_error(str(e), session)
        except Exception as e_inner:
            session.rollback()
            logger.error(f"Error updating status: {e_inner}")
            logger.error(f"Context: video_id: {video_id}")
    finally:
        session.close()
    
    # Теперь downloaded_file - путь к .mp3
    # Следующий шаг - сжатие .mp3 в .ogg

    logger.info("Hardcoded choice = 3 (convert to audio).")
    chosen_format = 'ogg'
    chosen_codec = 'libopus'   
    is_lossless = False       

    use_vbr = True
    logger.info("Hardcoded VBR for Opus = True.")

    max_size_float = 25
    logger.info("Hardcoded max_size = 25mb.")
    
    update_celery_task_state(
        task=self, 
        state="PROGRESS",
        meta={"step": "compress_audio", "percent": 50} 
    )
    
    with get_session() as sess:
        update_transcript_status(
            session=sess,
            video_id=video_id,
            status="compress_audio"
        )

    try:
        final_audio = compress_audio_extreme(
            input_file=downloaded_file,  # Теперь это .mp3
            chosen_format=chosen_format,
            chosen_codec=chosen_codec,
            is_lossless=is_lossless,
            max_size_mb=max_size_float,
            initial_bitrate_kbps=96,
            min_bitrate_kbps=32,
            use_vbr=use_vbr,
        )
        if final_audio and os.path.exists(final_audio):
            final_size_mb = get_file_size_mb(final_audio)
            logger.info(
                f"\nAudio compressed successfully to: {final_audio} "
                f"({final_size_mb:.2f} MB)."
            )
            logger.info(f"Final audio file: {final_audio} ({final_size_mb:.2f} MB)")
        else:
            logger.info(
                "\nAudio compression did not produce a final file. "
                "Check the logs for details."
            )
    except RuntimeError:
        logger.error("Audio conversion failed. Check log for details.")

    logger.info("Script finished.")
    logger.info("\nAll done! Check 'video_downloader.log' for a very detailed record of every step.")
    
    return {"audio_file_path": os.path.abspath(final_audio), "videoId": video_id}


@celery.task(bind=True)
def download_and_extract_fragment(self, video_url: str, start_time: str, end_time: str, user_id: str):
    """
    Celery задача для скачивания видео и вырезания фрагмента.

    :param video_url: URL видео на YouTube.
    :param start_time: Время начала фрагмента (формат HH:MM:SS).
    :param end_time: Время окончания фрагмента (формат HH:MM:SS).
    :param user_id: Идентификатор пользователя (для организации хранения файлов).
    :return: Путь к вырезанному фрагменту.
    """
    logger.info(f"Task started for user_id: {user_id}, video_url: {video_url}")

    # Директория для сохранения видео и фрагментов
    download_path = os.path.join("/app/convertorData", user_id)
    os.makedirs(download_path, exist_ok=True)

    # Генерация уникального имени для файла фрагмента
    fragment_filename = f"fragment_{uuid.uuid4().hex}.mp4"
    fragment_filepath = os.path.join(download_path, fragment_filename)

    with yt_dlp.YoutubeDL({'quiet': True}) as ydl_temp:
        info = ydl_temp.extract_info(video_url, download=False)
        
    cleaned_title = sanitize_filename(info.get('title', 'video'))

    try:
        # Скачивание видео в формате mp4 и разрешении 720p
        format_str = 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]'
        
        ydl_opts = {
            'format': format_str,  # best video + best audio, fallback to 'best'
            'outtmpl': os.path.join(download_path, f"{cleaned_title}.%(ext)s"),
            'logger': logger,
            'progress_hooks': [progress_hook],
            # Если у вас есть файл куки для возрастно-ограниченных видео:
            # 'cookiefile': '/path/to/cookies.txt',
        }

        downloaded_video = download_video(video_url, download_path, ydl_opts=ydl_opts)

        # Вырезание фрагмента
        extract_video_fragment(downloaded_video, fragment_filepath, start_time, end_time)
        
        with get_session() as session:
        
            create_or_update_download_fragment(
                session=session,
                user_id=user_id,
                video_url=video_url,
                start_time=start_time,
                end_time=end_time,
                fragment_path=fragment_filepath,
            )
            
        # (Опционально) Удаление полного видео, если оно больше не нужно
        os.remove(downloaded_video)
        logger.info(f"Full video removed: {downloaded_video}")

        return fragment_filepath

    except Exception as e:
        logger.error(f"Error in download_and_extract_fragment task: {e}")
        raise self.retry(exc=e, countdown=60, max_retries=3)