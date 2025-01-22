# Use a minimal Python 3.10 base image
FROM python:3.10-slim

# Create and use a working directory inside the container
WORKDIR /app

# Copy your requirements into the container
COPY app/requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY alembic.ini /app/
COPY alembic/ /app/alembic/

# Copy the entire 'app' folder into the container
COPY app/ /app/app/

# Expose port 5000 for Flask
EXPOSE 5000

# By default, run Gunicorn (for the Flask app)
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app.convertor_server:app"]
