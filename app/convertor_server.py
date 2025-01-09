import logging
import sys
from flask import Flask, request, jsonify
# from .tasks import triger_download
from tasks import triger_download
app = Flask(__name__)
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

# gunicorn точка входа останется такой же
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)