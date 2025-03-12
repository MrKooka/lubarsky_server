// components/VideoUrlInput.js
import React from "react";

function VideoUrlInput({ videoUrl, setVideoUrl, onSubmit, isLoading }) {
  return (
    <div className="mb-3">
      <label className="form-label">Link to video</label>
      <div className="input-group">
        <input
          type="text"
          className="form-control"
          placeholder="input video link"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={isLoading || !videoUrl}
        >
          {isLoading ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
                aria-hidden="true"
              ></span>
              Loading...
            </>
          ) : (
            "Получить форматы"
          )}
        </button>
      </div>
    </div>
  );
}

export default VideoUrlInput;
