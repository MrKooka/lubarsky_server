# app/services/transcript_service.py
from sqlalchemy.orm import Session
from app.models.models import Transcript
from app import setup_logger
import json


logger = setup_logger("app.services.transcript_service")

def update_transcript_status(session: Session, video_id: str, status: str):
    try:
        transcript = session.query(Transcript).filter_by(video_id=video_id).first()
        if transcript:
            transcript.update_status(status, session)
    except Exception as e:
        session.rollback()
        logger.error(f"Ошибка при обновлении статуса: {e}, video_id: {video_id}")
        raise


def create_or_update_transcript(session: Session, video_id: str, transcription: str, words_list: list):
    try:
        transcript = session.query(Transcript).filter_by(video_id=video_id).first()
        if not transcript:
            transcript = Transcript(video_id=video_id)
            session.add(transcript)
        
        transcript.transcript = transcription
        transcript.raw_json = json.dumps(words_list, ensure_ascii=False)
        transcript.status = "done"
        logger.info(f"Transcript for video_id '{video_id}' saved successfully")
    except Exception as e:
        session.rollback()
        logger.error(f"Error saving transcript: {e}, video_id: {video_id}")
        raise