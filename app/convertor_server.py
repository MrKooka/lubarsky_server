# /convertor_server.py
import logging
import sys
from flask import Flask, request, jsonify, send_from_directory
import os
# from .tasks import triger_download
from tasks import triger_download
from youtube_service import fetch_channel_videos, fetch_playlist_videos, fetch_video_comments, get_channel_playlists, fetch_video_details,search_channels
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
logger = logging.getLogger("YouTubeDownloader")


@app.route('/', methods=['GET'])
def index():
    return jsonify({"message": "Hello"}), 200

@app.route('/submit', methods=['GET', 'POST'])
def submit_video():
    if request.method == 'GET':
        video_url = request.args.get("video_url")
    else:  # POST
        data = request.json
        video_url = data.get("video_url")

    if not video_url:
        return jsonify({"error": "No URL provided"}), 400

    # Запускаем задачу в фоне
    task = triger_download.delay(video_url)
    # Возвращаем клиенту ID задачи, чтобы при желании он мог проверить статус
    return jsonify({
        "message": f"URL {video_url} submitted successfully!",
        "task_id": task.id
    }), 200


@app.route('/task_status/<task_id>', methods=['GET'])
def task_status(task_id):
    from celery_app import celery
    res = celery.AsyncResult(task_id)
    # res.state вернёт 'PENDING', 'STARTED', 'SUCCESS', 'FAILURE' ...
    # res.result вернёт то, что вернула ваша задача (или Exception при FAIL)
    return jsonify({
        "task_id": task_id,
        "state": res.state,
        "result": res.result
    })

@app.route('/download_audio/<task_id>', methods=['GET'])
def download_audio(task_id):
    from celery_app import celery
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

@app.route('/youtube/search_channel', methods=['GET'])
def search_channel():
    handle = request.args.get('handle')
    if not handle:
        return jsonify({'error': 'Channel handle is required'}), 400
    channels = search_channels(handle)
    return jsonify(channels), 200

@app.route('/youtube/transcribe_video/<video_id>', methods=['POST'])
def transcribe_video(video_id):
    # Placeholder for transcription logic
    data = request.get_json()
    if not data or 'videoId' not in data:
        return jsonify({'error': 'videoId is required'}), 400
    # Implement transcription logic here
    return jsonify({'transcript': 'Transcription service not implemented yet.'}), 200


# gunicorn точка входа останется такой же
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)