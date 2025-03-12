// components/VideoDownloadStatus.js - исправленная версия
import React from "react";
import DownloadProgressBar from "./DownloadProgressBar";

function VideoDownloadStatus({
  taskId,
  isComplete,
  onDownloadClick,
  onDownloadComplete,
}) {
  if (!taskId) return null;

  return (
    <>
      {!isComplete && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="mb-0">Loading progress</h5>
          </div>
          <div className="card-body">
            <DownloadProgressBar
              taskId={taskId}
              onDownloadComplete={onDownloadComplete}
              apiEndpoint="download_video_status"
            />
          </div>
        </div>
      )}

      {isComplete && (
        <div className="card mt-4 border-success">
          <div className="card-header bg-success text-white">
            <h5 className="mb-0">Loading completed</h5>
          </div>
          <div className="card-body text-center">
            <p className="mb-3">
              The video has been successfully uploaded and is ready for
              download.
            </p>
            <button
              className="btn btn-lg btn-primary"
              onClick={onDownloadClick}
            >
              <i className="bi bi-download me-2"></i> Download video
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default VideoDownloadStatus;
