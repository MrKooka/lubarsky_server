# app/models.py
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    DateTime,
    func
)
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Transcript(Base):
    __tablename__ = 'transcripts'

    id = Column(Integer, primary_key=True)
    video_id = Column(String(255), nullable=False)
    transcript = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

db = Base.metadata