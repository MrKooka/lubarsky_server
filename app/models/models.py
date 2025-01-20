# app/models.py
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


Base = declarative_base()

class Transcript(Base):
    __tablename__ = 'transcripts'

    video_id = Column(String(255), primary_key=True, nullable=False)
    transcript = Column(Text, nullable=True)
    raw_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    words = relationship('TranscriptionWord', back_populates='transcript', cascade="all, delete-orphan")


class TranscriptionWord(Base):
    __tablename__ = 'transcription_words'

    id = Column(Integer, primary_key=True)
    video_id = Column(String(255), ForeignKey('transcripts.video_id'), nullable=False)
    word = Column(String(255), nullable=False)
    start = Column(Float, nullable=False)
    end = Column(Float, nullable=False)

    transcript = relationship('Transcript', back_populates='words')
db = Base.metadata