#/app/services/convertor_service
from app.services.logging_service import setup_logger
import re
import unicodedata

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
    filename = re.sub(r'[^\w\s.\-\u0400-\u04FF]+', '_', filename)
    filename = transliterate(filename)
    # 2. Общая нормализация и вырезка не-ASCII
    filename = to_ascii(filename)
    # 3. Можно уже тут (или внутри to_ascii) заменить пробелы на _
    filename = filename.replace(' ', '_')
    return filename


TRANSLIT_DICT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
    'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
    'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
    'ш': 'sh', 'щ': 'sch','ъ': '',  'ы': 'y', 'ь': '',
    'э': 'e', 'ю': 'yu','я': 'ya'
}

def transliterate(text: str) -> str:
    """
   The simplest transliteration of Russian text into Latin.
Preserves case: if the letter was capitalized, we make the first Latin letter capitalized.
Example: "Биков" -> "Bykov"
    """
    result = []
    for char in text:
        lower_char = char.lower()
        if lower_char in TRANSLIT_DICT:
            # Берём транслитерацию из словаря
            translit_char = TRANSLIT_DICT[lower_char]
            # Сохраняем регистр, если исходная буква была заглавной
            if char.isupper() and translit_char:
                translit_char = translit_char.capitalize()
            result.append(translit_char)
        else:
            # Если символ не в словаре (цифры, пробелы, знаки препинания и т.п.) — оставляем как есть
            result.append(char)
    return ''.join(result)


def to_ascii(s: str) -> str:
    """
    Преобразует строку в ASCII:
    1. NFKD-нормализует (делит символы с диакритикой на Base + Combining),
    2. вырезает всё, что не умещается в ASCII (encode('ascii', 'ignore')),
    3. заменяет любые "лишние" символы (кроме a-z0-9 ._- ) на подчёркивания.
    """
    # 1. NFKD
    nfkd_form = unicodedata.normalize('NFKD', s)
    # 2. выкидываем всё, что не ASCII
    ascii_str = nfkd_form.encode('ascii', 'ignore').decode('ascii')
    # 3. заменяем все неразрешённые символы на '_'
    # Разрешаем буквы, цифры, точки, подчёркивания, дефисы
    ascii_str = re.sub(r'[^a-zA-Z0-9._-]+', '_', ascii_str)
    return ascii_str

def format_time_for_ffmpeg(seconds):
    """
    Форматирует время в секундах в формат HH:MM:SS.mmm для ffmpeg
    
    Параметры:
        seconds (float or str): Время в секундах
        
    Возвращает:
        str: Отформатированное время в формате HH:MM:SS.mmm
    """
    # Преобразуем входное значение в float, если это строка
    if isinstance(seconds, str):
        try:
            seconds = float(seconds)
        except ValueError:
            # Если строка уже в формате HH:MM:SS, просто возвращаем её
            if ":" in seconds:
                return seconds
            raise ValueError(f"Невозможно преобразовать '{seconds}' в число с плавающей точкой")
    
    # Теперь выполняем расчёты с числом
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def partial_content_generator(path, start, end):
    """Генератор для потоковой передачи частей файла"""
    with open(path, 'rb') as file:
        file.seek(start)
        remaining = end - start + 1
        chunk_size = 8192  # 8KB за раз
        
        while remaining:
            chunk = file.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk