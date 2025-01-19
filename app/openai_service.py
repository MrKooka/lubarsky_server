# ./app/openai_service.py

import openai
import os
from openai import OpenAI

# Загружаем API-ключ из окружения
API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=API_KEY)

def transcribe_audio(audio_path: str) -> str:
    with open(audio_path, "rb") as audio_file:
        raw_transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            timestamp_granularities=["word"]
        )
    return raw_transcription

