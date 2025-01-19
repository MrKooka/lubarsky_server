#./app/tasks.py

from app.celery_app import celery 
from app.convertor import download_youtube_video, compress_audio_extreme,get_file_size_mb
import logging
import os
import sys
from openai_service import transcribe_audio
logging.basicConfig(
    level=logging.DEBUG,  # Capture all logs: DEBUG, INFO, WARNING, ERROR, CRITICAL
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
    handlers=[
        logging.FileHandler("video_downloader.log", mode='a', encoding='utf-8'),
        logging.StreamHandler(sys.stdout),  # Also print to console
    ]
)
logger = logging.getLogger("app.tasker started")

@celery.task(bind=True,name="app.tasks.transcribe_audio_task")
def transcribe_audio_task(self, download_result):
    logger.info("transcribe_audio_task started. Using hardcoded parameters.")
    audio_path = download_result["audio_file_path"]
    video_id  = download_result["videoId"]
    raw_transcription = transcribe_audio(audio_path)
    return {"transcription":raw_transcription.text,"videoId":video_id}


@celery.task(bind=True, name='app.tasks.triger_download')
def triger_download(self, url):
    logger.info("Script started. Using hardcoded parameters.")
    video_url = url
    download_path = "./convertorData/"
    # 3) Скачиваем видео

    try:
        self.update_state(state="PROGRESS", meta={"step": "start_downloading", "percent": 0})
        videoData = download_youtube_video(video_url, download_path)
        self.update_state(state="PROGRESS", meta={"step": "start_downloading", "percent": 20})
        downloaded_file = videoData['downloaded_filename']
    except Exception as e:
        logger.error(f"Failed to download video. Reason: {e}")
        print("Download failed. Check the log for details.")
        print("video_url:",video_url,"download_path:",download_path)
        sys.exit(1)
    # 4) Вместо выбора (1/2/3) – сразу говорим «3» (convert to audio)
    logger.info("Hardcoded choice = 3 (convert to audio).")

    # Вместо запроса формата – жёстко ставим 'ogg' + сопутствующие параметры
    chosen_format = 'ogg'
    chosen_codec = 'libopus'   
    is_lossless = False        # Opus – это lossy

    # Вместо запроса "Enable VBR? (y/n)" – всегда True
    use_vbr = True
    logger.info("Hardcoded VBR for Opus = True.")

    # Вместо запроса max_size – ставим None (т.е. без лимита)
    max_size_float = 25
    logger.info("Hardcoded max_size = 25mb.")

    try:
        final_audio = compress_audio_extreme(
            input_file=downloaded_file,
            chosen_format=chosen_format,
            chosen_codec=chosen_codec,
            is_lossless=is_lossless,
            max_size_mb=max_size_float,
            initial_bitrate_kbps=96,
            min_bitrate_kbps=32,
            use_vbr=use_vbr,
            videoId=videoData['videoId']
        )
        self.update_state(state="PROGRESS", meta={"step": "compress_audio_extreme", "percent": 50})
        if final_audio and os.path.exists(final_audio):
            final_size_mb = get_file_size_mb(final_audio)
            print(
                f"\nAudio compressed successfully to: {final_audio} "
                f"({final_size_mb:.2f} MB)."
            )
            logger.info(f"Final audio file: {final_audio} ({final_size_mb:.2f} MB)")
        else:
            print(
                "\nAudio compression did not produce a final file. "
                "Check the logs for details."
            )
    except RuntimeError:
        print("Audio conversion failed. Check log for details.")

    logger.info("Script finished.")
    print("\nAll done! Check 'video_downloader.log' for a very detailed record of every step.")
    
    return {"audio_file_path":os.path.abspath(final_audio),"videoId":videoData['videoId']}

