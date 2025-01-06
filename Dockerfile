# Используем официальный образ Python
FROM python:3.10-slim

# Устанавливаем зависимости
WORKDIR /app
COPY ./app/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt


COPY . .

# Запускаем приложение через Gunicorn
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:convertor_server:app"]
