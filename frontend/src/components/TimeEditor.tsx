function TimeEditor({
  startTime,
  endTime,
  currentTime,
  duration,
  startTimeValues,
  endTimeValues,
  isEditingStartTime,
  isEditingEndTime,
  formatTime,
  onSetStartTime,
  onSetEndTime,
  onChangeStartTime,
  onChangeEndTime,
  onConfirmStartTime,
  onConfirmEndTime,
}) {
  return (
    <div className="mb-3">
      <h6>Current position: {formatTime(currentTime)}</h6>

      {/* Полоса прогресса */}
      <div
        className="progress mb-3"
        style={{ height: "20px", position: "relative" }}
      >
        <div
          className="progress-bar bg-danger"
          style={{ width: "100%", opacity: 0.3 }}
        ></div>
        <div
          className="progress-bar bg-success"
          style={{
            width: `${((endTime - startTime) / duration) * 100}%`,
            position: "absolute",
            height: "100%",
            left: `${(startTime / duration) * 100}%`,
            opacity: 0.7,
          }}
        ></div>
      </div>

      {/* Редактор времени начала */}
      <div className="mb-3">
        <div className="d-flex align-items-center mb-2">
          <button
            className="btn btn-sm btn-success me-2"
            onClick={onSetStartTime}
          >
            Set Start
          </button>
          <span className="fw-bold">Start Time: {formatTime(startTime)}</span>
        </div>

        {isEditingStartTime && (
          <div className="card p-3 border-success mb-3">
            <div className="time-editor d-flex align-items-center mb-2">
              <div
                className="input-group input-group-sm"
                style={{ maxWidth: "300px" }}
              >
                <input
                  type="number"
                  min="0"
                  className="form-control text-center"
                  value={startTimeValues.hours}
                  onChange={(e) => onChangeStartTime("hours", e.target.value)}
                />
                <span className="input-group-text">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="form-control text-center"
                  value={startTimeValues.minutes}
                  onChange={(e) => onChangeStartTime("minutes", e.target.value)}
                />
                <span className="input-group-text">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="form-control text-center"
                  value={startTimeValues.seconds}
                  onChange={(e) => onChangeStartTime("seconds", e.target.value)}
                />
              </div>
              <button
                className="btn btn-sm btn-outline-success ms-2"
                onClick={onConfirmStartTime}
              >
                <i className="bi bi-check-lg"></i> Apply
              </button>
            </div>
            <small className="text-muted">Format: hours:minutes:seconds</small>
          </div>
        )}
      </div>

      {/* Редактор времени окончания */}
      <div className="mb-3">
        <div className="d-flex align-items-center mb-2">
          <button className="btn btn-sm btn-danger me-2" onClick={onSetEndTime}>
            Set End
          </button>
          <span className="fw-bold">End Time: {formatTime(endTime)}</span>
        </div>

        {isEditingEndTime && (
          <div className="card p-3 border-danger mb-3">
            <div className="time-editor d-flex align-items-center mb-2">
              <div
                className="input-group input-group-sm"
                style={{ maxWidth: "300px" }}
              >
                <input
                  type="number"
                  min="0"
                  className="form-control text-center"
                  value={endTimeValues.hours}
                  onChange={(e) => onChangeEndTime("hours", e.target.value)}
                />
                <span className="input-group-text">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="form-control text-center"
                  value={endTimeValues.minutes}
                  onChange={(e) => onChangeEndTime("minutes", e.target.value)}
                />
                <span className="input-group-text">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="form-control text-center"
                  value={endTimeValues.seconds}
                  onChange={(e) => onChangeEndTime("seconds", e.target.value)}
                />
              </div>
              <button
                className="btn btn-sm btn-outline-danger ms-2"
                onClick={onConfirmEndTime}
              >
                <i className="bi bi-check-lg"></i> Apply
              </button>
            </div>
            <small className="text-muted">Format: hours:minutes:seconds</small>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimeEditor;
