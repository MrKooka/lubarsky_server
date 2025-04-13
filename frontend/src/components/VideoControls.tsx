import React from "react";

function VideoControls({
  startTime,
  endTime,
  isLoading,
  deleteOriginal,
  onDeleteOriginalChange,
  onPreviewSegment,
  onDownloadVideo,
  onDownloadAudio,
  onDownloadSilentVideo,
  onCutVideo,
  onDownloadFragment,
  fragmentStatus = null,
  fragmentTaskId = null,
  silentVideoTaskId = null,
  silentVideoStatus = null
}) {
  // Определение статуса и стилей для отображения процесса обработки фрагмента
  const renderFragmentStatus = () => {
    if (!fragmentStatus) return null;

    if (fragmentStatus === "PENDING" || fragmentStatus === "PROGRESS") {
      return (
        <div className="d-flex align-items-center ms-3">
          <div className="spinner-border spinner-border-sm text-success me-2" role="status" />
          <span className="text-success">Processing fragment...</span>
        </div>
      );
    }

    if (fragmentStatus === "FAILURE") {
      return (
        <div className="d-flex align-items-center ms-3">
          <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
          <span className="text-danger">Processing failed</span>
        </div>
      );
    }

    if (fragmentStatus === "SUCCESS") {
      return (
        <div className="d-flex align-items-center ms-3">
          <i className="bi bi-check-circle-fill text-success me-2"></i>
          <span className="text-success">Fragment ready</span>
        </div>
      );
    }

    return null;
  };

  // Статус для видео без звука
  const renderSilentVideoStatus = () => {
    if (!silentVideoStatus) return null;

    if (silentVideoStatus === "PENDING" || silentVideoStatus === "PROGRESS") {
      return (
        <div className="d-flex align-items-center ms-3">
          <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
          <span className="text-primary">Removing audio...</span>
        </div>
      );
    }

    if (silentVideoStatus === "FAILURE") {
      return (
        <div className="d-flex align-items-center ms-3">
          <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
          <span className="text-danger">Audio removal failed</span>
        </div>
      );
    }

    if (silentVideoStatus === "SUCCESS") {
      return (
        <div className="d-flex align-items-center ms-3">
          <i className="bi bi-check-circle-fill text-primary me-2"></i>
          <span className="text-primary">Silent video ready</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="video-controls-container">
      {/* Чекбокс над кнопками */}
      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="deleteOriginalCheckbox"
          checked={deleteOriginal}
          onChange={(e) => onDeleteOriginalChange(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="deleteOriginalCheckbox">
          Delete original video after cutting
        </label>
      </div>
      
      {/* Кнопки управления в одну линию */}
      <div className="d-flex flex-wrap align-items-center">
        <button
          className="btn btn-primary me-2 mb-2"
          onClick={onPreviewSegment}
          disabled={startTime >= endTime}
        >
          <i className="bi bi-play-fill me-1"></i>
          Preview Segment
        </button>

        <button
          className="btn btn-success me-2 mb-2"
          onClick={onCutVideo}
          disabled={startTime >= endTime || isLoading}
        >
          {isLoading ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              ></span>
              Processing...
            </>
          ) : (
            <>
              <i className="bi bi-scissors me-1"></i>
              Cut Video
            </>
          )}
        </button>

        {/* Кнопки скачивания */}
        <div className="btn-group me-2 mb-2">
          <button
            className="btn btn-outline-secondary"
            onClick={onDownloadVideo}
          >
            <i className="bi bi-film me-1"></i>
            Full Video
          </button>
          
          <button
            className="btn btn-outline-secondary"
            onClick={onDownloadAudio}
          >
            <i className="bi bi-music-note-beamed me-1"></i>
            Audio
          </button>
          
          <button
            className="btn btn-outline-secondary"
            onClick={onDownloadSilentVideo}
          >
            <i className="bi bi-volume-mute-fill me-1"></i>
            No Audio
          </button>
        </div>

        {/* Кнопка Download Fragment (показывается только когда фрагмент готов) */}
        {fragmentTaskId && fragmentStatus === "SUCCESS" && (
          <button
            className="btn btn-outline-success me-2 mb-2"
            onClick={onDownloadFragment}
          >
            <i className="bi bi-download me-1"></i>
            Download Fragment
          </button>
        )}

        {/* Статус обработки фрагмента */}
        {renderFragmentStatus()}
        
        {/* Статус удаления аудио */}
        {renderSilentVideoStatus()}
      </div>
    </div>
  );
}

export default VideoControls;