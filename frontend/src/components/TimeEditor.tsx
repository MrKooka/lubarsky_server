import React, { useState, useEffect } from "react";

function TimeEditor({
  startTime,
  endTime,
  currentTime,
  duration,
  startTimeValues,
  endTimeValues,
  formatTime,
  onChangeStartTime,
  onChangeEndTime,
  onConfirmStartTime,
  onConfirmEndTime,
}) {
  // Состояния для отслеживания изменений и обратной связи
  const [isStartTimeModified, setIsStartTimeModified] = useState(false);
  const [isEndTimeModified, setIsEndTimeModified] = useState(false);
  const [showSuccessFeedback, setShowSuccessFeedback] = useState(false);

  // Сбросить индикатор успешного применения через 2 секунды
  useEffect(() => {
    if (showSuccessFeedback) {
      const timer = setTimeout(() => {
        setShowSuccessFeedback(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessFeedback]);

  // Обертки для обработчиков изменений
  const handleStartTimeChange = (field, value) => {
    setIsStartTimeModified(true);
    onChangeStartTime(field, value);
  };

  const handleEndTimeChange = (field, value) => {
    setIsEndTimeModified(true);
    onChangeEndTime(field, value);
  };

  // Обработчик для кнопки Apply
  const handleApply = () => {
    onConfirmStartTime();
    onConfirmEndTime();
    setIsStartTimeModified(false);
    setIsEndTimeModified(false);
    setShowSuccessFeedback(true);
  };

  // Определение классов для полей ввода
  const startTimeBorderClass = isStartTimeModified 
    ? "border-danger" 
    : showSuccessFeedback 
      ? "border-success" 
      : "";
      
  const endTimeBorderClass = isEndTimeModified 
    ? "border-danger" 
    : showSuccessFeedback 
      ? "border-success" 
      : "";

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

      {/* Редактор времени в одной строке */}
      <div className="card p-3 mb-3">
        <div className="d-flex align-items-center flex-wrap">
          {/* Start Time */}
          <div className={`d-flex align-items-center me-3 mb-2 mb-md-0 ${startTimeBorderClass}`}>
            <span className="fw-bold me-2">Start Time:</span>
            <div className={`input-group input-group-sm ${startTimeBorderClass}`} style={{ width: "200px" }}>
              <input
                type="number"
                min="0"
                className="form-control text-center"
                style={{ minWidth: "50px", padding: "0.375rem 0.5rem" }}
                value={startTimeValues.hours}
                onChange={(e) => handleStartTimeChange("hours", e.target.value)}
              />
              <span className="input-group-text">:</span>
              <input
                type="number"
                min="0"
                max="59"
                className="form-control text-center"
                style={{ minWidth: "50px", padding: "0.375rem 0.5rem" }}
                value={startTimeValues.minutes}
                onChange={(e) => handleStartTimeChange("minutes", e.target.value)}
              />
              <span className="input-group-text">:</span>
              <input
                type="number"
                min="0"
                max="59"
                className="form-control text-center" 
                style={{ minWidth: "50px", padding: "0.375rem 0.5rem" }}
                value={startTimeValues.seconds}
                onChange={(e) => handleStartTimeChange("seconds", e.target.value)}
              />
            </div>
          </div>

          {/* End Time */}
          <div className={`d-flex align-items-center me-3 mb-2 mb-md-0 ${endTimeBorderClass}`}>
            <span className="fw-bold me-2">End Time:</span>
            <div className={`input-group input-group-sm ${endTimeBorderClass}`} style={{ width: "200px" }}>
              <input
                type="number"
                min="0"
                className="form-control text-center"
                style={{ minWidth: "50px", padding: "0.375rem 0.5rem" }}
                value={endTimeValues.hours}
                onChange={(e) => handleEndTimeChange("hours", e.target.value)}
              />
              <span className="input-group-text">:</span>
              <input
                type="number"
                min="0"
                max="59"
                className="form-control text-center"
                style={{ minWidth: "50px", padding: "0.375rem 0.5rem" }}
                value={endTimeValues.minutes}
                onChange={(e) => handleEndTimeChange("minutes", e.target.value)}
              />
              <span className="input-group-text">:</span>
              <input
                type="number"
                min="0"
                max="59"
                className="form-control text-center"
                style={{ minWidth: "50px", padding: "0.375rem 0.5rem" }}
                value={endTimeValues.seconds}
                onChange={(e) => handleEndTimeChange("seconds", e.target.value)}
              />
            </div>
          </div>

          {/* Apply Button */}
          <button
            className={`btn ${showSuccessFeedback ? 'btn-success' : 'btn-primary'} ms-auto`}
            onClick={handleApply}
          >
            <i className={`bi ${showSuccessFeedback ? 'bi-check-lg' : 'bi-check2'}`}></i> 
            {showSuccessFeedback ? 'Applied!' : 'Apply'}
          </button>
        </div>
        <small className="text-muted mt-2">Format: hours:minutes:seconds</small>
      </div>
    </div>
  );
}

export default TimeEditor;