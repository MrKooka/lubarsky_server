# app/models/models.py
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    DateTime,
    func,
    ForeignKey,
    Float
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from app.services.logging_service import setup_logger
from dataclasses import dataclass
from werkzeug.security import generate_password_hash, check_password_hash 

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
    transcripts = relationship('Transcript', back_populates='user', cascade="all, delete-orphan")

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
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True) 

    words = relationship('TranscriptionWord', back_populates='transcript', cascade="all, delete-orphan")
    user = relationship('User', back_populates='transcripts')  

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
db = Base.metadata