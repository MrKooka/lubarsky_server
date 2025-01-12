from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/submit', methods=['POST'])
def submit_video():
    data = request.json
    video_url = data.get("https://n8n.intplab.com/webhook-test/video-transcript")
    if not video_url:
        return jsonify({"error": "No URL provided"}), 400
    
    # TODO: отправить URL в n8n webhook
    return jsonify({"message": f"URL {video_url} submitted successfully!"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
