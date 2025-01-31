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

# app/services/download_fragment_service.py
import json
from sqlalchemy.orm import Session
from app.models.models import DownloadFragment
from app import setup_logger

logger = setup_logger("app.services.download_fragment_service")


def create_or_update_download_fragment(
    session: Session,
    user_id: str,
    video_url: str,
    start_time: str,
    end_time: str,
    fragment_path: str,
):
    """
    Создаёт или обновляет запись DownloadFragment в БД.

    :param session: Сессия SQLAlchemy
    :param user_id: ID пользователя
    :param video_url: Ссылка на YouTube-видео
    :param start_time: Начало фрагмента (HH:MM:SS)
    :param end_time: Конец фрагмента (HH:MM:SS)
    :param fragment_path: Путь к обрезанному файлу на сервере
    :param status: Статус, например 'done' или 'processing'
    """
    try:
        # Определите сами, по каким полям "ищете" существующую запись
        # Например, предполагаем уникальность по (user_id, video_url, start_time, end_time)
        fragment = (
            session.query(DownloadFragment)
            .filter_by(
                user_id=user_id,
                video_url=video_url,
                start_time=start_time,
                end_time=end_time
            )
            .first()
        )

        # Если не нашли, создаём новую
        if not fragment:
            fragment = DownloadFragment(
                user_id=user_id,
                video_url=video_url,
                start_time=start_time,
                end_time=end_time,
            )
            session.add(fragment)

        # Обновляем поля
        fragment.fragment_path = fragment_path
        # Если в модели есть поле 'status', вы можете его обновить
        # (Для примера, пусть оно будет status или что-то подобное)
        # fragment.status = status

        logger.info(
            f"DownloadFragment for user_id='{user_id}' и video_url='{video_url}' "
            f"({start_time}-{end_time}) сохранён/обновлён успешно"
        )

    except Exception as e:
        session.rollback()
        logger.error(f"Ошибка при сохранении/обновлении DownloadFragment: {e}")
        raise
