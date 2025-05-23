# ./app/__init__.py
from .models import db  
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .services.logging_service import setup_logger

load_dotenv()

user = os.environ.get("POSTGRES_USER")
password = os.environ.get("POSTGRES_PASSWORD")
debug = os.environ.get("DEBUG")
host = os.environ.get("DB_HOST")
port = os.environ.get("DB_PORT")
dbatabase = os.environ.get("POSTGRES_DB")
# DATABASE_URL = f"postgresql://{os.environ.get('POSTGRES_USER')}:{os.environ.get('POSTGRES_PASSWORD')}@{os.environ.get('DB_HOST', 'localhost')}:5432/{os.environ.get('POSTGRES_DB')}"
DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbatabase}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
logger = setup_logger("app")