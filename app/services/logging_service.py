# app/services/logging_service.py

import logging
import sys

# Определите ANSI коды для цветов
RESET = "\x1b[0m"
RED = "\x1b[31m"
GREEN = "\x1b[32m"
YELLOW = "\x1b[33m"
BLUE = "\x1b[34m"
MAGENTA = "\x1b[35m"
CYAN = "\x1b[36m"
WHITE = "\x1b[37m"

class ColorFormatter(logging.Formatter):
    """Formatter for adding colors to log messages."""

    COLORS = {
        logging.DEBUG: WHITE,
        logging.INFO: GREEN,
        logging.WARNING: YELLOW,
        logging.ERROR: RED,
        logging.CRITICAL: MAGENTA,
    }

    def format(self, record):
        color = self.COLORS.get(record.levelno, WHITE)
        message = super().format(record)
        return f"{color}{message}{RESET}"

def setup_logger(name: str = "app.logger") -> logging.Logger:
    """
    Configures and returns the logger named `name`.
    
    :param name: Logger name.
    :return: Configured logger.
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)  # Setting the logging level

    # Check if the handler has already been added
    if not logger.handlers:
        # Create a handler to write to a file
        file_handler = logging.FileHandler("video_downloader.log", mode='a', encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)

        # Create a handler for console output
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)

        #Create a ColorFormatter instance and a regular Formatter for the file
        color_formatter = ColorFormatter('[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s')
        file_formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s')

        # Assign formatters to handlers
        console_handler.setFormatter(color_formatter)
        file_handler.setFormatter(file_formatter)

        # ДAdd handlers to the logger
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

    return logger
