# ./app/services/progress_service.py
import os
import re
import time
import logging
import threading

import yt_dlp

# ---------------------------
# Регулярное выражение для поиска прогресса вида "70.3%"
PROGRESS_PATTERN = re.compile(r'(\d{1,3}(?:\.\d+)?)%')

def print_progress_bar(percentage, bar_length=50):
    """
    (Для отладочных целей) Печатает прогресс-бар по значению percentage (0–100).
    bar_length задаёт длину "полосы".
    """
    filled_length = int(bar_length * percentage / 100.0)
    bar = '=' * filled_length + '-' * (bar_length - filled_length)
    print(f"\r[{bar}] {percentage:5.2f}%", end='', flush=True)

def tail_log_file(filepath, stop_event, update_progress_func):
    """
    «Хвостим» файл с логами в отдельном потоке:
      - открываем в режиме чтения,
      - переходим в конец,
      - каждые ~0.2с читаем новые строки,
      - если нашли процент — вызываем update_progress_func(число).
    Когда в stop_event ставим True, выходим из цикла.
    """
    with open(filepath, "r") as f:
        # Переходим сразу в конец файла, чтобы не обрабатывать «старые» логи
        f.seek(0, 2) 
        while not stop_event.is_set():
            line = f.readline()
            if not line:
                time.sleep(0.2)
                continue

            # Парсим строку регуляркой
            match = PROGRESS_PATTERN.search(line)
            if match:
                progress = float(match.group(1))
                # Вызываем пользовательскую функцию обновления
                update_progress_func(progress)

    # После выхода из цикла можно напечатать, что всё готово
    print("\nDownload complete!")


def start_download(video_url, ydl_opts):
    """
    Запускаем сам процесс скачивания. 
    yt_dlp будет писать логи через свой 'logger'.
    """
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])

