#./app/tasks.py

from app.celery_app import celery 
from app.convertor import download_youtube_video, compress_audio_extreme,get_file_size_mb
import os
import sys
from app.openai_service import transcribe_audio
import json
from app import SessionLocal,setup_logger
from app.models.models import Transcript
from app.services.transcript_service import update_transcript_status, create_or_update_transcript
from app.services.celery_state_service import update_celery_task_state
from app.services.database_service import get_session
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
        state="transcribing",
        meta={"step": "start_transcribing", "percent": 90} 
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
        state="done",
        meta={"step": "done", "percent": 100} 
    )

    return {"transcription":raw_transcription.text,"videoId":video_id}


@celery.task(bind=True, name='app.tasks.triger_download')
def triger_download(self, video_id):
    logger.info("Script started. Using hardcoded parameters.")
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    download_path = "./convertorData/"
    session = SessionLocal()

    update_celery_task_state(
        task=self, 
        state="downloading",
        meta={"step": "downloading", "percent": 10} 
    )

    with session as sess:
        update_transcript_status(
            session=sess,
            video_id=video_id,
            status="downloading"
        )

    try:
        videoData = download_youtube_video(video_url, download_path)
        downloaded_file = videoData['downloaded_filename']
    except Exception as e:
        logger.error(f"Failed to download video. Reason: {e}")
        try:
            with get_session() as session:
                transcript = session.query(Transcript).filter_by(video_id=video_id).first()
                transcript.update_status('error', session)
                transcript.update_error(str(e), session)
        except Exception as e:
            session.rollback()
            logger.error(f"Error updating status: {e}")
            logger.error(f"Context: video_id: {video_id}")
    finally:
        session.close()
    
    
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
        state="compress_audio",
        meta={"step": "compress_audio", "percent": 50} 
    )
    
    with session as sess:
        update_transcript_status(
            session=sess,
            video_id=video_id,
            status="compress_audio"
        )

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
    
    return {"audio_file_path":os.path.abspath(final_audio),"videoId":videoData['videoId']}

