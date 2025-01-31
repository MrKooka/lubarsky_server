#/app/services/convertor_service
from app.services.logging_service import setup_logger
import re

logger = setup_logger("app.convertor")

def progress_hook(d):
    """
    Progress hook for yt-dlp that logs each download progress event.
    """
    if d['status'] == 'downloading':
        fraction = d.get('_percent_str', '').strip()
        speed = d.get('_speed_str', 'N/A').strip()
        eta = d.get('_eta_str', 'N/A').strip()
        logger.debug(f"Downloading... {fraction} at {speed} ETA: {eta}")
    elif d['status'] == 'finished':
        logger.info("Download complete; now post-processing if needed.")
    elif d['status'] == 'error':
        logger.error("Error during download!")

def sanitize_filename(filename):
    # Заменяем специальные символы на подчёркивания
    return re.sub(r'[^\w\s.-]', '_', filename)
