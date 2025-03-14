# /convertor_server.py
import re
import json
from dateutil import parser
import logging
import sys
from flask import Flask, request, jsonify, send_from_directory,send_file,Response,redirect, url_for
import os
# from .tasks import triger_download
from app.tasks import triger_download_audio,transcribe_audio_task,download_video_task,extract_fragment_
from app.youtube_service import (
    fetch_channel_videos, 
    fetch_playlist_videos, 
    fetch_video_comments, 
    get_channel_playlists, 
    fetch_video_details,
    search_channels,
    get_youtube_video_id_from_url,
)
from flask_cors import CORS
from app import SessionLocal
from celery import chain
from celery.result import AsyncResult
from app.celery_app import celery
from app.models.models import Transcript, User, UserTranscript, DownloadFragment
from app.services.database_service import get_session
from app.services.convertor_service import transliterate,partial_content_generator
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import yt_dlp

load_dotenv()

app = Flask(__name__)
CORS(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False  
jwt = JWTManager(app)
logger = logging.getLogger("YouTubeDownloader")
logger.setLevel(logging.DEBUG)  # Устанавливаем уровень DEBUG для всех логов
handler = logging.StreamHandler(sys.stdout)  # Вывод в stdout для Docker logs
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

# Настройка корневого логгера для захвата всех логов
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)
root_handler = logging.StreamHandler(sys.stdout)
root_handler.setLevel(logging.DEBUG)
root_handler.setFormatter(formatter)
root_logger.addHandler(root_handler)

# Отключаем распространение логов, чтобы избежать дублирования
logger.propagate = False
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


# Добавьте этот код сразу после создания объекта app = Flask(__name__)

# Настройка логгера для вывода в stdout (консоль Docker)
import logging
import sys

# Настройка основного логгера для приложения
app.logger.setLevel(logging.DEBUG)  # Устанавливаем уровень DEBUG для всех логов
handler = logging.StreamHandler(sys.stdout)  # Вывод в stdout для Docker logs
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] [REQUEST] %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)

# Декоратор для логирования всех входящих запросов
@app.before_request
def log_request_info():
    # Логируем метод и путь
    app.logger.debug(f"Request: {request.method} {request.path}")
    
    # Логируем заголовки
    headers = dict(request.headers)
    app.logger.debug(f"Headers: {headers}")
    
    # Логируем параметры запроса
    args = dict(request.args)
    if args:
        app.logger.debug(f"Query parameters: {args}")
    
    # Логируем тело запроса для POST/PUT и т.д.
    if request.method in ['POST', 'PUT', 'PATCH'] and request.is_json:
        try:
            body = request.get_json()
            app.logger.debug(f"Request JSON body: {body}")
        except Exception as e:
            app.logger.debug(f"Failed to parse JSON body: {str(e)}")
    elif request.method in ['POST', 'PUT', 'PATCH']:
        try:
            # Для не-JSON запросов (например, form-data)
            app.logger.debug(f"Form data: {request.form}")
            # Если есть файлы
            if request.files:
                files = {k: v.filename for k, v in request.files.items()}
                app.logger.debug(f"Files: {files}")
            # Сырые данные, если не форма
            if not request.form and not request.files and request.data:
                app.logger.debug(f"Raw request data: {request.data}")
        except Exception as e:
            app.logger.debug(f"Error processing request body: {str(e)}")
@app.route('/', methods=['GET'])
def index():
    return jsonify({"message": "Hello"}), 200

@app.route('/transcript', methods=['GET', 'POST'])
@jwt_required()
def transcript_video():
    user_id = get_jwt_identity()
    # serialize_object(request.get_json(), "endpoint-transcript-request.pkl")
    if request.method == 'GET':
        video_url = request.args.get("video_url")
        data = {}  
    else:  # POST
        data = request.json
        video_url = data.get("video_url")

    if not video_url:
        return jsonify({"error": "No URL provided"}), 400
    
    video_id = get_youtube_video_id_from_url(video_url)
    if not video_id:
        return jsonify({"error": "Invalid YouTube URL or Video ID not found"}), 400

    with get_session() as session:
        try:
            transcript = session.query(Transcript).filter_by(video_id=video_id).first()
            
            # Если такой записи ещё нет - создаём и заполняем поля
            if not transcript:
                logger.debug("transcript not found, creating a new one.")
                transcript = Transcript(video_id=video_id)
                transcript.title = data.get('title')
                transcript.description = data.get('description')
                published_at_str = data.get('published_at')
                if published_at_str:
                    try:
                        transcript.published_at = parser.parse(published_at_str)
                    except Exception as e:
                        logger.warning(f"Cannot parse published_at: {e}")
                
                transcript.channel_id = data.get('channel_id')
                transcript.channel_title = data.get('channel_title')
                transcript.category_id = data.get('category_id')
                transcript.thumbnail_url = data.get('thumbnail_url')
                
                # tags - храним как JSON-строку (или любой другой удобный формат)
                tags = data.get('tags')
                if tags and isinstance(tags, list):
                    transcript.tags = json.dumps(tags, ensure_ascii=False)
                
                transcript.duration = data.get('duration')
                transcript.dimension = data.get('dimension')
                transcript.definition = data.get('definition')
                
                # caption может приходить как 'true'/'false' (строка) или булево
                # Возьмём за правило, что 'true'/'True' = True, иначе False
                caption_value = data.get('caption')
                transcript.caption = str(caption_value).lower() == 'true'

                # licensed_content, embeddable, public_stats_viewable
                # по условию могут быть уже булевы, но на всякий случай приводим
                transcript.licensed_content = bool(data.get('licensed_content'))
                transcript.embeddable = bool(data.get('embeddable'))
                transcript.public_stats_viewable = bool(data.get('public_stats_viewable'))
                transcript.projection = data.get('projection')

                # Статистические поля часто приходят в строках, приведём к int
                view_count = data.get('view_count')
                transcript.view_count = int(view_count) if view_count is not None else None

                like_count = data.get('like_count')
                transcript.like_count = int(like_count) if like_count is not None else None

                dislike_count = data.get('dislike_count')
                transcript.dislike_count = int(dislike_count) if dislike_count is not None else None

                favorite_count = data.get('favorite_count')
                transcript.favorite_count = int(favorite_count) if favorite_count is not None else None

                comment_count = data.get('comment_count')
                transcript.comment_count = int(comment_count) if comment_count is not None else None

                transcript.privacy_status = data.get('privacy_status')
                transcript.license = data.get('license')

                # Можно сразу выставить статус 'pending' или оставить по умолчанию
                transcript.status = 'pending'
                transcript.user_id = user_id
                # Добавляем запись в сессию
                session.add(transcript)
            
            else:
                logger.debug(f"transcript found. transcript.status {transcript.status}")

                # Если транскрипция уже завершена
                if transcript.status == "done":
                    return jsonify({
                        "transcript": transcript.transcript,
                        "videoId": transcript.video_id,
                        "created_at": transcript.created_at
                    }), 200
                # Если не завершена, отправим статус
                else:
                    return jsonify({
                        "status": transcript.status,
                        "videoId": transcript.video_id,
                        "created_at": transcript.created_at
                    }), 200


            #Link user to this video_id (UserTranscript)
            user_trans_link = session.query(UserTranscript)\
            .filter_by(user_id=user_id, video_id=video_id).first()
            
            if not user_trans_link:
                user_trans_link = UserTranscript(user_id=user_id, video_id=video_id)
                session.add(user_trans_link)
        except Exception as e:
            logger.error(f"Error saving transcript: {e}")
            raise

    # Запуск Celery-цепочки
    workflow = chain(
        triger_download_audio.s(video_id,user_id),
        transcribe_audio_task.s() 
    )
    
    chain_result = workflow.apply_async()
    triger_download_task_id = chain_result.parent.id
    transcribe_audio_task_id = chain_result.id
    
    return jsonify({
        "message": f"URL {video_url} submitted successfully!",
        "triger_download_task_id": triger_download_task_id,
        "transcribe_audio_task_id": transcribe_audio_task_id,
        "already_linked": True
    }), 200

@app.route("/task_status/<task_id>", methods=["GET"])
def get_transcription(task_id):
    # создаём объект результата на основе ID
    res = AsyncResult(task_id, app=celery)

    # проверяем статус
    if res.state == 'PENDING':
        # задача либо ещё не запустилась, либо нет такого id
        return jsonify({"status": "PENDING"})
    elif res.state == 'PROGRESS':
        # задача идёт, можно вернуть проценты, которые вы залогировали в meta
        return jsonify({"status": "PROGRESS", "meta": res.info})
    elif res.state == 'SUCCESS':
        # когда задача закончилась, в res.result будет итоговый return
        # который вернул ваш transcribe_audio_task
        return jsonify({"status": "SUCCESS", "result": res.result})
    else:
        # возможны варианты: FAILURE, REVOKED и т.д.
        return jsonify({"status": res.state, "info": str(res.info)})
    
@app.route('/youtube/search_channel', methods=['GET'])
def search_channel():
    handle = request.args.get('handle')
    if not handle:
        return jsonify({'error': 'Channel handle is required'}), 400
    channels = search_channels(handle)
    return jsonify(channels), 200


# @app.route('/youtube/fetch_channel_videos_by_url', methods=['GET'])
# def fetch_channel_videos_by_url():
#     """
#     Endpoint to fetch videos from a YouTube channel using the full channel URL.

#     Query Parameters:
#         channel_url (str): The full YouTube channel URL (e.g., https://www.youtube.com/@AIAritiv).
#         max_results (int, optional): Number of videos per request. Defaults to 10.
#         max_content (int, optional): Maximum number of videos to fetch. Defaults to 20.

#     Returns:
#         JSON response containing videos, hasMore flag, and nextPageToken.
#     """
#     channel_url = request.args.get('channel_url', default=None, type=str)
#     max_results = request.args.get('max_results', default=10, type=int)
#     max_content = request.args.get('max_content', default=20, type=int)

#     if not channel_url:
#         return jsonify({'error': 'channel_url parameter is required.'}), 400

#     try:
#         # Extract channel handle
#         channel_handle = extract_channel_id_from_url(channel_url)
#     except ValueError as ve:
#         return jsonify({'error': str(ve)}), 400

#     # Search for the channel to get channel_id
#     channels = search_channels(channel_handle, max_results=1)
#     if not channels:
#         return jsonify({'error': 'Channel not found.'}), 404

#     channel_id = channels[0]['channel_id']

#     # Fetch videos using channel_id
#     result = fetch_channel_videos(channel_id, max_results, page_token=None, max_content=max_content)

#     # Handle error messages
#     if 'message' in result:
#         return jsonify({'error': result['message']}), 404

#     return jsonify(result), 200

# @app.route('/task_status/<task_id>', methods=['GET'])
# def task_status(task_id):
#     from app.celery_app import celery
#     res = celery.AsyncResult(task_id)
#     # res.state вернёт 'PENDING', 'STARTED', 'SUCCESS', 'FAILURE' ...
#     # res.result вернёт то, что вернула ваша задача (или Exception при FAIL)
#     return jsonify({
#         "task_id": task_id,
#         "state": res.state,
#         "result": res.result
#     })


@app.route('/youtube/get_channel_playlists/<channel_id>',methods=['GET'])
def get_channel_playlists_endpoint(channel_id):
    playlists = get_channel_playlists(channel_id)
    return jsonify(playlists)

@app.route('/youtube/fetch_playlist_videos/<playlist_id>',methods=['GET'])
def fetch_playlist_videos_endpoint(playlist_id):
    response = fetch_playlist_videos(playlist_id)
    return jsonify(response)

@app.route('/youtube/fetch_channel_videos/<channel_id>', methods=['GET'])
def fetch_channel_videos_endpoing(channel_id):
    max_results = request.args.get('max_results', default=50, type=int)
    videos = fetch_channel_videos(channel_id, max_results=max_results)
    return jsonify(videos)

@app.route("/youtube/fetch_video_details/<videoId>", methods=['GET'])
def fetch_video_details_endpoint(videoId):
    videos_ditails = fetch_video_details(videoId)
    return jsonify(videos_ditails)


@app.route('/youtube/transcribe_video/<video_id>', methods=['POST'])
def transcribe_video(video_id):
    # Placeholder for transcription logic
    data = request.get_json()
    if not data or 'videoId' not in data:
        return jsonify({'error': 'videoId is required'}), 400
    # Implement transcription logic here
    return jsonify({'transcript': 'Transcription service not implemented yet.'}), 200

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', None)
    password = data.get('password', None)

    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400

    with get_session() as session:
        existing_user = session.query(User).filter_by(username=username).first()
        if existing_user:
            return jsonify({"msg": "Username already exists"}), 409

        new_user = User(username=username)
        new_user.set_password(password)
        session.add(new_user)

        return jsonify({"msg": "User created successfully"}), 201
        
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', None)
    password = data.get('password', None)

    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400

    with get_session() as session:
        user = session.query(User).filter_by(username=username).first()
        if not user or not user.check_password(password):
            return jsonify({"msg": "Bad username or password"}), 401

        access_token = create_access_token(identity=str(user.id))
        return jsonify(access_token=access_token), 200


@app.route('/protected', methods=['GET'])
@jwt_required()
def protected():
    current_user_id = get_jwt_identity()
    with get_session() as session:
        user = session.query(User).get(current_user_id)
        if not user:
            return jsonify({"msg": "User not found"}), 404
        return jsonify({"username": user.username}), 200


@app.route('/user-transcripts', methods=['GET'])
@jwt_required()
def get_user_transcripts():
    user_id = get_jwt_identity()

    with get_session() as session:
        links = session.query(UserTranscript).filter_by(user_id=user_id).all()
        
        result = []
        for link in links:
            t:Transcript = link.transcript  # Это объект Transcript
            result.append({
                "video_id": t.video_id,
                "title": t.title,
                "description": t.description,
                "status": t.status,
                "published_at":t.published_at,
                "thumbnail_url":t.thumbnail_url,
                "channel_title":t.channel_title,
                "channel_id":t.channel_id,
                "duration":t.duration
            })
        
    return jsonify(result), 200

@app.route("/check-user-transcript", methods=["GET"])
@jwt_required()
def check_user_transcript():
    user_id = get_jwt_identity()
    video_id = request.args.get("video_id")
    if not video_id:
        return jsonify({"error": "video_id param is required"}), 400

    with get_session() as session:
        existing_link = session.query(UserTranscript).filter_by(
            user_id=user_id,
            video_id=video_id
        ).first()
        if existing_link:
            return jsonify({"already_linked": True}), 200
        else:
            return jsonify({"already_linked": False}), 200


@app.route("/add-user-transcript", methods=["POST"])
@jwt_required()
def add_user_transcript():
    user_id = get_jwt_identity()  
    data = request.json
    video_id = data.get("video_id")

    if not video_id:
        return jsonify({"message": "video_id is required"}), 400

    with get_session() as session:
        # Проверяем, есть ли уже такой Transcript
        transcript = session.query(Transcript).get(video_id)
        if not transcript:
            # Можно либо создать новый Transcript, либо вернуть ошибку.
            # Для примера — создадим заготовку со статусом 'pending'.
            transcript = Transcript(video_id=video_id, status="pending")
            session.add(transcript)
            session.commit()

        # Проверяем, не добавлен ли этот Transcript уже этому пользователю
        existing_link = session.query(UserTranscript).filter_by(
            user_id=user_id,
            video_id=video_id
        ).first()

        if existing_link:
            # Уже связан — возвращаем какой-нибудь "ОК"
            return jsonify({
                    "message": "Transcript already linked to user",
                    "already_linked": True
            }), 200

        # Если связи нет — создаём
        link = UserTranscript(user_id=user_id, video_id=video_id)
        session.add(link)
        session.commit()

    return jsonify({"message": "success","already_linked": True}), 201



@app.route('/user_downloads', methods=['GET'])
@jwt_required()
def user_downloads():
    user_id = get_jwt_identity()
    try:
        with get_session() as session:
            downloads = session.query(DownloadFragment).filter_by(user_id=user_id).all()
            
            if not downloads:
                return jsonify({
                    "downloads": [],
                    "message": "У вас пока нет скачанных видео."
                }), 200
            
            # Формируем список словарей для ответа внутри сессии
            result = []
            for d in downloads:
                result.append({
                    "id": d.id,
                    "video_url": d.video_url,
                    "start_time": d.start_time,
                    "end_time": d.end_time,
                    "fragment_path": d.fragment_path,
                    "created_at": d.created_at.isoformat()
                })
        
        return jsonify({
            "downloads": result,
            "message": "Список скачанных видео успешно получен."
        }), 200

    except Exception as e:
        app.logger.error(f"Ошибка при обработке /user_downloads: {e}")
        return jsonify({"error": "Внутренняя ошибка сервера"}), 500
    



# ================================================================
# ===================== AUDIO ENDPOINTS ==========================
# ================================================================

@app.route('/download_audio', methods=['POST','GET'])
@jwt_required()
def download_audio_endpoint():
    """
    1) Принимает JSON: {"video_id": "..."} или {"video_url": "..."}
    2) Запускает Celery-задачу на скачивание (triger_download).
    3) Возвращает task_id и статус 202.
    """
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    # Если вы в задаче используете "video_id", а не "video_url",
    # можно назвать это поле "video_id".
    video_url = data.get('video_url')  
    video_id = get_youtube_video_id_from_url(video_url)
    if not video_id:
        return jsonify({"error": "video_id is required"}), 400

    # Запускаем Celery-задачу
    task = triger_download_audio.apply_async(args=[video_id, user_id])

    return jsonify({
        "message": "Аудио скачивается",
        "task_id": task.id
    }), 202


@app.route('/download_audio_status/<task_id>', methods=['GET'])
@jwt_required()
def download_audio_status(task_id):
    """
    Узнаём статус Celery-задачи скачивания видео (triger_download).
    Возвращаем JSON:
      - { "status": "PROGRESS", "percent": 42, ... } или
      - { "status": "SUCCESS" } и т.д.
    """
    task = AsyncResult(task_id, app=celery)
    
    if task.state == 'PENDING':
        return jsonify({"status": "PENDING"}), 202

    elif task.state == 'PROGRESS':
        meta = task.info or {}
        return jsonify({
            "status": "PROGRESS",
            "percent": meta.get("percent", 0),
            "step": meta.get("step", "")
        }), 202

    elif task.state == 'FAILURE':
        return jsonify({
            "status": "FAILURE",
            "error": str(task.info)
        }), 400

    elif task.state == 'SUCCESS':
        # В SUCCESS в task.result = {"audio_file_path": "...", "videoId": ...}
        return jsonify({
            "status": "SUCCESS"
        }), 200

    else:
        # STARTED / RETRY...
        return jsonify({"status": task.state}), 202


@app.route('/get_downloaded_audio/<task_id>', methods=['GET'])
@jwt_required()
def get_downloaded_audio(task_id):
    """
    Возвращает полное скачанное видео (если задача SUCCESS).
    """
    task = AsyncResult(task_id, app=celery)
    if task.state != 'SUCCESS':
        # Можно вернуть 404 или 202, в зависимости от того, что вам нужно
        return jsonify({"error": f"Задача не в состоянии SUCCESS, а {task.state}"}), 400

    result = task.result or {}
    logger.debug(f"get_downloaded_audio celery_tasker result: {result}")
    video_path = result.get('audio_file_path')  # Или 'video_file_path' - смотря что у вас возвращает triger_download
    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": "Файл не найден на диске"}), 404

    # Можно проверить, что user_id = get_jwt_identity() совпадает с путём...
    # if str(user_id) not in video_path: ...

    # Возвращаем файл для проигрывания/скачивания
    # Если хотим отдать для <video>, лучше не использовать "as_attachment=True"
    # Тогда клиент сможет воспроизводить поток
    return send_file(video_path)


@app.route('/video_qualities', methods=['GET'])
@jwt_required()
def list_video_qualities():
    """
    Возвращает список форматов, где vcodec != 'none'.
    При этом для каждого формата формируем строку 'video_id+best_audio_id',
    чтобы при скачивании видео и аудио объединились в итоговом файле.
    Фильтрует разрешения в диапазоне от 360 до 1080.
    """
    try:
        # Логируем входящий запрос
        user_id = get_jwt_identity()
        video_url = request.args.get('video_url')
        logger.error(f"video_url: {video_url}")
        if not video_url:
            return jsonify({"error": "video_url is required"}), 400

        # Упрощенные параметры для yt_dlp
        ydl_opts = {
            'quiet': True,
            'nocheckcertificate': True,
            'skip_download': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36',
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                logger.info(f"Extracting info for: {video_url}")
                info = ydl.extract_info(video_url, download=False)
        except Exception as ydl_error:
            logger.error(f"yt_dlp error: {str(ydl_error)}")
            return jsonify({"error": f"Could not process video URL: {str(ydl_error)}"}), 422

        if not info:
            logger.error("No info was extracted from the URL")
            return jsonify({"error": "No info could be extracted from the URL"}), 422

        all_formats = info.get('formats', [])
        if not all_formats:
            logger.error("No formats found in extracted info")
            return jsonify({"error": "No formats found for this video"}), 422

        # 1) Выберем лучший аудиоформат
        audio_formats = [f for f in all_formats if f.get('acodec', 'none') != 'none']
        if not audio_formats:
            logger.warning("No audio formats found")
            best_audio_id = None
        else:
            best_audio = max(audio_formats, key=lambda f: f.get('abr') or 0)
            best_audio_id = best_audio['format_id']
            logger.info(f"Best audio format: {best_audio_id}")

        # 2) Форматы только с видео
        video_formats = [f for f in all_formats if f.get('vcodec', 'none') != 'none']
        if not video_formats:
            logger.error("No video formats found")
            return jsonify({"error": "No video formats found for this URL"}), 422

        # 3) Фильтруем видео от 360 до 1080
        filtered_video_formats = []
        for vf in video_formats:
            height = vf.get('height')
            if height and 360 <= height <= 1080:
                filtered_video_formats.append(vf)
        
        if not filtered_video_formats:
            logger.warning("No formats found in the 360-1080 range")
            # Если не нашлось форматов в указанном диапазоне, вернем все форматы
            filtered_video_formats = video_formats

        # 4) Собираем комбинированный format_id
        result_formats = []
        for vf in filtered_video_formats:
            v_id = vf.get("format_id")
            combined_id = f"{v_id}+{best_audio_id}" if best_audio_id else v_id
            result_formats.append({
                "format_id": combined_id,
                "resolution": vf.get("resolution"),
                "width": vf.get("width"),
                "height": vf.get("height"),
                "fps": vf.get("fps"),
                "filesize": vf.get("filesize"),
                "format_note": vf.get("format_note"),
            })

        logger.info(f"Found {len(result_formats)} video formats in 360-1080 range")
        return jsonify({
            "video_title": info.get("title"),
            "formats": result_formats
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error processing video URL: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# ================================================================
# ===================== VIDEO ENDPOINTS ==========================
# ================================================================


@app.route('/download_video', methods=['POST'])
@jwt_required()
def download_video_endpoint():
    """
    1) Принимает JSON: {"video_url": "...", "format_id": "..."}
    2) Запускает Celery-задачу на скачивание (download_video_task).
    3) Возвращает task_id и статус 202.
    """
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    video_url = data.get('video_url')
    format_id = data.get('format_id')

    if not video_url:
        return jsonify({"error": "video_url is required"}), 400
    if not format_id:
        return jsonify({"error": "format_id is required"}), 400

    task = download_video_task.apply_async(args=[video_url, format_id, user_id])
    return jsonify({
        "message": "Видео скачивается",
        "task_id": task.id
    }), 202

@app.route('/download_video_status/<task_id>', methods=['GET'])
@jwt_required()
def download_video_status(task_id):
    """
    Узнаём статус Celery-задачи скачивания видео (download_video_task).
    """
    task = AsyncResult(task_id, app=celery)

    if task.state == 'PENDING':
        return jsonify({"status": "PENDING"}), 202
    elif task.state == 'PROGRESS':
        meta = task.info or {}
        return jsonify({
            "status": "PROGRESS",
            "percent": meta.get("percent", 0),
            "step": meta.get("step", "")
        }), 202
    elif task.state == 'FAILURE':
        return jsonify({
            "status": "FAILURE",
            "error": str(task.info)
        }), 400
    elif task.state == 'SUCCESS':
        return jsonify({
            "status": "SUCCESS"
        }), 200
    else:
        return jsonify({"status": task.state}), 202


# @app.route('/get_downloaded_video/<task_id>', methods=['GET'])
# @jwt_required()
# def get_downloaded_video(task_id):
#     """
#     Возвращает готовый видеофайл (если задача в SUCCESS).
#     """
#     task = AsyncResult(task_id, app=celery)
#     logger.error(f'get_downloaded_videostate:{task.state} result:{task.result}')
#     if task.state != 'SUCCESS':
#         return jsonify({"error": f"Задача не в состоянии SUCCESS, а {task.state}"}), 400

#     result = task.result or {}
#     video_path = result.get('file_path')
#     print("video_path:",video_path)
#     logger.error(f"get_downloaded_video , video_path: {video_path}, result:{result}")
#     if not video_path or not os.path.exists(video_path):
#         return jsonify({"error": "Файл не найден на диске"}), 404
    
#     filename = os.path.basename(video_path)

#     return send_file(
#         video_path,
#         as_attachment=True,
#         download_name=filename,
#         etag=True,
#         max_age=0
#     )


    
# ================================================================
# ===================== FRAGMENT ENDPOINTS =======================
# ================================================================

@app.route('/cut_video', methods=['POST'])
@jwt_required()
def cut_video():
    """
    Вырезает фрагмент из видео.
    Принимает JSON:
      {
        "task_id": "xxx",
        "start_time": 10.5, // в секундах
        "end_time": 20.7,   // в секундах
        "delete_original": false // флаг для удаления оригинального видео
      }
    """
    user_id = get_jwt_identity()
    data = request.get_json()
    logger.debug("request_data:", data)
    logger.error("request_data:", data)
    task_id = data.get('task_id')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    delete_original = data.get('delete_original', False) # По умолчанию False, если не указано
    
    if not (task_id and start_time is not None and end_time is not None):
        return jsonify({"error": "task_id, start_time, end_time are required"}), 400
    
    # Получаем путь к файлу из результата задачи
    original_task = AsyncResult(task_id)
    if not original_task.ready() or original_task.state != 'SUCCESS':
        return jsonify({"error": f"Task is not ready or failed: {original_task.state}"}), 400
        
    try:
        result = original_task.result
        if isinstance(result, dict):
            file_path = result.get("file_path")
        else:
            file_path = result
    except Exception as e:
        logger.error(f"Error retrieving file path from task: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
    # Проверяем, что файл существует
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "Video file not found"}), 404
    
    # Запускаем задачу на обрезку видео с передачей флага удаления оригинала
    task = extract_fragment_.apply_async(
        args=[file_path, start_time, end_time, user_id, delete_original]
    )
    
    return jsonify({
        "message": "Cutting video...",
        "task_id": task.id
    }), 202

@app.route('/get_fragment/<task_id>', methods=['GET'])
@jwt_required()
def get_fragment(task_id):
    """
    Возвращает вырезанный фрагмент видео (если задача extract_fragment в SUCCESS).
    
    :param task_id: ID задачи extract_fragment_.
    :return: Файл фрагмента видео или JSON с ошибкой.
    """
    user_id = get_jwt_identity()
    task = AsyncResult(task_id, app=celery)
    
    logger.debug(f'get_fragment task state: {task.state}, result: {task.result}')
    
    if task.state != 'SUCCESS':
        return jsonify({
            "error": f"Задача вырезания фрагмента не завершена, текущий статус: {task.state}"
        }), 400
    
    result = task.result or {}
    fragment_path = result.get('fragment_path')
    
    logger.info(f"get_fragment, fragment_path: {fragment_path}, result: {result}")
    
    if not fragment_path or not os.path.exists(fragment_path):
        return jsonify({"error": "Файл фрагмента не найден на диске"}), 404
    
    # Проверка, что фрагмент принадлежит запрашивающему пользователю
    # (опционально, если у вас хранятся фрагменты в папках с user_id)
    if str(user_id) not in fragment_path:
        logger.warning(f"Attempted unauthorized access to fragment by user {user_id}")
        return jsonify({"error": "У вас нет доступа к этому фрагменту"}), 403
    
    filename = os.path.basename(fragment_path)

    # Опционально: обновить счетчик скачиваний или другие метрики
    
    return send_file(
        fragment_path,
        as_attachment=True,
        download_name=filename,
        etag=True,
        max_age=0
    )


@app.route('/extract_fragment_status/<task_id>', methods=['GET'])
@jwt_required()
def extract_fragment_status(task_id):
    """
    Получает статус задачи вырезания фрагмента видео.
    
    :param task_id: ID задачи extract_fragment_.
    :return: JSON с информацией о статусе задачи.
    """
    task = AsyncResult(task_id, app=celery)
    
    if task.state == 'PENDING':
        return jsonify({"status": "PENDING"}), 202
    
    elif task.state == 'PROGRESS':
        meta = task.info or {}
        return jsonify({
            "status": "PROGRESS",
            "percent": meta.get("percent", 0),
            "step": meta.get("step", "")
        }), 202
    
    elif task.state == 'FAILURE':
        return jsonify({
            "status": "FAILURE",
            "error": str(task.info)
        }), 400
    
    elif task.state == 'SUCCESS':
        return jsonify({
            "status": "SUCCESS",
            "fragment_path": task.result.get("fragment_path") if task.result else None
        }), 200
    
    else:
        return jsonify({"status": task.state}), 202


@app.route('/stream_video/<task_id>', methods=['GET'])
@jwt_required()
def stream_video(task_id):
    """
    Потоковая передача видео с поддержкой частичных запросов (Range)
    """
    task = AsyncResult(task_id, app=celery)
    
    if task.state != 'SUCCESS':
        return jsonify({"error": f"Задача не в состоянии SUCCESS, а {task.state}"}), 400

    result = task.result or {}
    video_path = result.get('file_path')
    
    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": "Файл не найден на диске"}), 404
    
    file_size = os.path.getsize(video_path)
    
    # Обработка Range запросов для потоковой передачи
    range_header = request.headers.get('Range', None)
    
    if range_header:
        byte_start, byte_end = 0, None
        match = re.search(r'(\d+)-(\d*)', range_header)
        groups = match.groups()
        
        if groups[0]:
            byte_start = int(groups[0])
        if groups[1]:
            byte_end = int(groups[1])
            
        if byte_end is None:
            byte_end = file_size - 1
            
        length = byte_end - byte_start + 1
        
        resp = Response(
            partial_content_generator(video_path, byte_start, byte_end),
            206,
            mimetype='video/mp4',
            content_type='video/mp4',
            direct_passthrough=True
        )
        
        resp.headers.add('Content-Range', f'bytes {byte_start}-{byte_end}/{file_size}')
        resp.headers.add('Accept-Ranges', 'bytes')
        resp.headers.add('Content-Length', str(length))
        return resp
    
    # Если не Range запрос, то возвращаем метаданные о файле
    return send_file(
        video_path,
        mimetype='video/mp4',
        as_attachment=False,
        etag=True,
        conditional=True
    )


@app.route('/get_video_metadata/<task_id>', methods=['GET'])
@jwt_required()
def get_video_metadata(task_id):
    """
    Возвращает только метаданные видео без самого файла.
    """
    task = AsyncResult(task_id, app=celery)
    
    if task.state != 'SUCCESS':
        return jsonify({"error": f"Задача не в состоянии SUCCESS, а {task.state}"}), 400

    result = task.result or {}
    video_path = result.get('file_path')
    
    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": "Файл не найден на диске"}), 404
    
    filename = os.path.basename(video_path)
    
    # Можно добавить дополнительные метаданные, например размер файла, длительность видео и т.д.
    file_size = os.path.getsize(video_path)
    
    # Если есть возможность получить длительность видео с помощью ffprobe или другой библиотеки
    # duration = get_video_duration(video_path)
    
    return jsonify({
        "filename": filename,
        "file_size": file_size,
        # "duration": duration,  # если доступно
        "task_state": task.state
    })

@app.route('/get_downloaded_video/<task_id>', methods=['GET'])
def get_downloaded_video(task_id):
    """
    Возвращает готовый видеофайл с поддержкой потоковой передачи.
    """
    task = AsyncResult(task_id, app=celery)
    logger.debug(f'get_downloaded_videostate:{task.state} result:{task.result}')
    
    if task.state != 'SUCCESS':
        return jsonify({"error": f"Задача не в состоянии SUCCESS, а {task.state}"}), 400

    result = task.result or {}
    video_path = result.get('file_path')
    
    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": "Файл не найден на диске"}), 404
    
    filename = os.path.basename(video_path)
    file_size = os.path.getsize(video_path)
    
    # Обработка Range запросов для потоковой передачи
    range_header = request.headers.get('Range', None)
    
    if range_header:
        byte_start, byte_end = 0, None
        match = re.search(r'(\d+)-(\d*)', range_header)
        groups = match.groups()
        
        if groups[0]:
            byte_start = int(groups[0])
        if groups[1]:
            byte_end = int(groups[1])
            
        if byte_end is None:
            byte_end = file_size - 1
            
        length = byte_end - byte_start + 1
        
        resp = Response(
            partial_content_generator(video_path, byte_start, byte_end),
            206,
            mimetype='video/mp4',
            content_type='video/mp4',
            direct_passthrough=True
        )
        
        resp.headers.add('Content-Range', f'bytes {byte_start}-{byte_end}/{file_size}')
        resp.headers.add('Accept-Ranges', 'bytes')
        resp.headers.add('Content-Length', str(length))
        resp.headers.add('Content-Disposition', f'attachment; filename="{filename}"')
        return resp
    
    # Если не Range запрос, отправляем весь файл с поддержкой потоковой передачи
    return send_file(
        video_path,
        mimetype='video/mp4',
        as_attachment=True,
        download_name=filename,
        etag=True,
        conditional=True
    )

@app.route('/download_redirect/<task_id>/<token>', methods=['GET'])
def download_redirect(task_id, token):
    # Проверяем токен
    try:
        jwt.decode(token, app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
    except:
        return jsonify({"error": "Invalid token"}), 401
    
    # Перенаправляем на скачивание
    return redirect(url_for('get_downloaded_video', task_id=task_id))
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)