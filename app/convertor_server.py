# /convertor_server.py
import json
from dateutil import parser
import logging
import sys
from flask import Flask, request, jsonify, send_from_directory
import os
# from .tasks import triger_download
from app.tasks import triger_download,transcribe_audio_task
from app.youtube_service import (
    fetch_channel_videos, 
    fetch_playlist_videos, 
    fetch_video_comments, 
    get_channel_playlists, 
    fetch_video_details,
    search_channels,
    get_youtube_video_id_from_url
)
from flask_cors import CORS
from app import SessionLocal
from celery import chain
from celery.result import AsyncResult
from app.celery_app import celery
from app.models.models import Transcript, User, UserTranscript
from app.services.database_service import get_session
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
load_dotenv()

app = Flask(__name__)
CORS(app)
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False  
jwt = JWTManager(app)
logger = logging.getLogger("YouTubeDownloader")
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)



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
        triger_download.s(video_id),
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

@app.route('/download_audio/<task_id>', methods=['GET'])
def download_audio(task_id):
    from app.celery_app import celery
    res = celery.AsyncResult(task_id)

    # Check that task is done
    if res.state == 'SUCCESS':
        audio_filepath = res.result  # e.g. /app/convertorData/video_name.ogg
        if audio_filepath and os.path.exists(audio_filepath):
            directory = os.path.dirname(audio_filepath)
            filename = os.path.basename(audio_filepath)
            # Return the file as an attachment (i.e., "download" in browser)
            return send_from_directory(directory, filename, as_attachment=True)
        else:
            return jsonify({"error": "File not found on server"}), 404
    else:
        return jsonify({
            "error": "Task not in SUCCESS state",
            "state": res.state
        }), 400


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

# gunicorn точка входа останется такой же
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)