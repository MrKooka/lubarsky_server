function VideoControls({
  startTime,
  endTime,
  isLoading,
  deleteOriginal,
  onDeleteOriginalChange,
  onPreviewSegment,
  onDownloadVideo,
  onCutVideo,
}) {
  return (
    <div className="d-flex justify-content-between align-items-center">
      <button
        className="btn btn-primary"
        onClick={onPreviewSegment}
        disabled={startTime >= endTime}
      >
        <i className="bi bi-play-fill me-1"></i>
        Preview Segment
      </button>

      <div>
        <div className="form-check mb-2">
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

        <button
          className="btn btn-outline-secondary me-2"
          onClick={onDownloadVideo}
        >
          <i className="bi bi-download me-1"></i>
          Download
        </button>

        <button
          className="btn btn-success"
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
      </div>
    </div>
  );
}

export default VideoControls;
