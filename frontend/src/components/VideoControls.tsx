import React from "react";

function VideoControls({
  startTime,
  endTime,
  isLoading,
  deleteOriginal,
  onDeleteOriginalChange,
  onPreviewSegment,
  onDownloadVideo,
  onCutVideo,
  onDownloadAudio,
  onDownloadFragment,
  fragmentStatus = null,
  fragmentTaskId = null
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

        {/* Отдельные кнопки вместо выпадающего списка */}
        <button
          className="btn btn-outline-secondary me-2 mb-2"
          onClick={onDownloadVideo}
        >
          <i className="bi bi-film me-1"></i>
          Full Video
        </button>

        <button
          className="btn btn-outline-secondary me-2 mb-2"
          onClick={onDownloadAudio}
        >
          <i className="bi bi-music-note-beamed me-1"></i>
          Audio
        </button>

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
      </div>
    </div>
  );
}

export default VideoControls;