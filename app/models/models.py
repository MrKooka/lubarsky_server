# app/models/models.py
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Float

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from app.services.logging_service import setup_logger
from dataclasses import dataclass
from werkzeug.security import generate_password_hash, check_password_hash 
from sqlalchemy.sql import func


logger = setup_logger("app.models.models")

Base = declarative_base()

@dataclass
class User(Base):
    __tablename__ = 'users'

    id: int
    username: str
    password_hash: str

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(150), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Убираем .transcripts, потому что связь "многие-ко-многим" теперь живёт в UserTranscript
    # transcripts = relationship('Transcript', back_populates='user')  # <-- УДАЛИТЬ

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)
        logger.debug(f"Password for user {self.username} set.")

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)



class Transcript(Base):
    __tablename__ = 'transcripts'

    video_id = Column(String(255), primary_key=True, nullable=False)
    transcript = Column(Text, nullable=True)
    raw_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default='pending')  
    error = Column(String(255), nullable=True)  
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    channel_id = Column(String(255), nullable=True)
    channel_title = Column(String(255), nullable=True)
    category_id = Column(String(50), nullable=True)
    thumbnail_url = Column(String(512), nullable=True)
    tags = Column(Text, nullable=True) 
    duration = Column(String(50), nullable=True)
    dimension = Column(String(50), nullable=True)
    definition = Column(String(50), nullable=True)
    caption = Column(Boolean, nullable=True)
    licensed_content = Column(Boolean, nullable=True)
    projection = Column(String(50), nullable=True)
    view_count = Column(Integer, nullable=True)
    like_count = Column(Integer, nullable=True)
    dislike_count = Column(Integer, nullable=True)
    favorite_count = Column(Integer, nullable=True)
    comment_count = Column(Integer, nullable=True)
    privacy_status = Column(String(50), nullable=True)
    license = Column(String(50), nullable=True)
    embeddable = Column(Boolean, nullable=True)
    public_stats_viewable = Column(Boolean, nullable=True)


    words = relationship('TranscriptionWord', back_populates='transcript', cascade="all, delete-orphan")

    def update_status(self, new_status, session):
        """
        statuses: done, downloading, transcribing, error
        """
        try:
            self.status = new_status
            session.add(self)
            session.commit()
        except Exception as e:
            logger.error(f"Transcript.update_status error {e}")
            raise

    def update_error(self, error, session):
        try:
            self.error = error
            session.add(self)
            session.commit()
        except Exception as e:
            logger.error(f"Transcript.update_error error {e}")
            raise


class TranscriptionWord(Base):
    __tablename__ = 'transcription_words'

    id = Column(Integer, primary_key=True)
    video_id = Column(String(255), ForeignKey('transcripts.video_id'), nullable=False)
    word = Column(String(255), nullable=False)
    start = Column(Float, nullable=False)
    end = Column(Float, nullable=False)

    transcript = relationship('Transcript', back_populates='words')

class UserTranscript(Base):
    __tablename__ = 'user_transcript'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    video_id = Column(String(255), ForeignKey('transcripts.video_id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship('User', backref='user_transcripts')
    transcript = relationship('Transcript', backref='user_transcripts')

db = Base.metadata


