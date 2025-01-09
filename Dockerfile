# /Dockerfile
FROM python:3.10-slim

COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Запускаем gunicorn
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "convertor_server:app"]
