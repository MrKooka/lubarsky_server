from app import SessionLocal
from contextlib import contextmanager
from app import setup_logger

logger = setup_logger("app.services.database_service")

@contextmanager
def get_session():
    session = SessionLocal()
    try:
        yield session
        session.commit()
        logger.debug("Session committed successfully")
    except Exception as e:
        session.rollback()
        logger.error(f"Session rollback due to exception: {e}")
        raise
    finally:
        session.close()
        logger.debug("Session closed")