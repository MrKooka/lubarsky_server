FROM python:3.10-slim
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "convertor_server:app"]
