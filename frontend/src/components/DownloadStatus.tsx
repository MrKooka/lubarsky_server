import React from "react";
import DownloadProgressBar from "./DownloadProgressBar";

function DownloadStatus({
  taskId,
  isComplete,
  onDownloadClick,
  onDownloadComplete,
  mediaType = "Video", // "Video" или "Audio"
  apiEndpoint = "download_video_status", // По умолчанию для видео
}) {
  if (!taskId) return null;

  // Определяем заголовки в зависимости от типа медиа
  const progressHeader = `${mediaType} Download Progress`;
  const completeHeader = `${mediaType} Download Complete`;
  const completeMessage = `The ${mediaType.toLowerCase()} has been successfully processed and is ready for download.`;
  const buttonText = `Download ${mediaType}`;

  return (
    <>
      {!isComplete && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="mb-0">{progressHeader}</h5>
          </div>
          <div className="card-body">
            <DownloadProgressBar
              taskId={taskId}
              onDownloadComplete={onDownloadComplete}
              apiEndpoint={apiEndpoint}
            />
          </div>
        </div>
      )}

      {isComplete && (
        <div className="card mt-4 border-success">
          <div className="card-header bg-success text-white">
            <h5 className="mb-0">{completeHeader}</h5>
          </div>
          <div className="card-body text-center">
            <p className="mb-3">{completeMessage}</p>
            <button
              className="btn btn-lg btn-primary"
              onClick={onDownloadClick}
            >
              <i className="bi bi-download me-2"></i> {buttonText}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default DownloadStatus;
