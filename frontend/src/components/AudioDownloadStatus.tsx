import React, { useState, useEffect, useRef } from "react";

function AudioDownloadStatus({
  taskId,
  isComplete,
  onDownloadClick,
  onDownloadComplete,
  apiEndpoint = "download_audio_status"
}) {
  const [status, setStatus] = useState("PENDING");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  
  // Храним последний успешный статус, чтобы избежать мерцания
  const [stableStatus, setStableStatus] = useState(null);

  // При изменении status, устанавливаем stableStatus только если достигнут финальный статус
  useEffect(() => {
    if (status === "SUCCESS" || status === "FAILURE") {
      setStableStatus(status);
    }
  }, [status]);

  // Start polling when taskId changes
  useEffect(() => {
    // Очищаем предыдущий интервал при изменении taskId
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!taskId) {
      // Reset state when no taskId
      setStatus("IDLE");
      setProgress(0);
      setError(null);
      setStableStatus(null);
      return;
    }

    // Set initial state
    setStatus("PENDING");
    setProgress(0);
    setError(null);

    // Create polling function
    const pollStatus = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`/api/${apiEndpoint}/${taskId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const data = await response.json();
        setStatus(data.status);

        // Set progress if available
        if (data.status === "PROGRESS" && data.percent !== undefined) {
          setProgress(data.percent);
        }

        // Handle completion
        if (data.status === "SUCCESS") {
          setProgress(100);
          if (onDownloadComplete) {
            onDownloadComplete();
          }
          
          // Очищаем интервал при успешном завершении
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }

        // Handle error
        if (data.status === "FAILURE") {
          setError(data.error || "An error occurred");
          
          // Очищаем интервал при ошибке
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        setError(err.message);
        setStatus("FAILURE");
        
        // Очищаем интервал при ошибке
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    // Initial check
    pollStatus();

    // Set up polling interval
    intervalRef.current = setInterval(pollStatus, 2000);

    // Clean up interval on unmount or taskId change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskId, apiEndpoint, onDownloadComplete]);

  // If no taskId, don't render anything
  if (!taskId) {
    return null;
  }

  // Если stableStatus SUCCESS, показываем кнопку скачивания
  if (stableStatus === "SUCCESS" && isComplete) {
    return (
      <div className="audio-status-container" style={{ minHeight: "70px" }}>
        <div className="alert alert-success d-flex align-items-center">
          <i className="bi bi-check-circle-fill me-2"></i>
          <div className="flex-grow-1">Audio extraction complete!</div>
          <button
            className="btn btn-sm btn-success"
            onClick={onDownloadClick}
          >
            <i className="bi bi-download me-1"></i>
            Download Audio
          </button>
        </div>
      </div>
    );
  }

  // Если stableStatus FAILURE, показываем ошибку
  if (stableStatus === "FAILURE" || error) {
    return (
      <div className="audio-status-container" style={{ minHeight: "70px" }}>
        <div className="alert alert-danger d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <div>{error || "Audio extraction failed"}</div>
        </div>
      </div>
    );
  }

  // Во всех других случаях показываем прогресс
  return (
    <div className="audio-status-container" style={{ minHeight: "70px" }}>
      <div className="d-flex align-items-center">
        <div className="me-2">
          <small>Extracting audio...</small>
        </div>
        <div className="flex-grow-1">
          <div className="progress" style={{ height: "20px" }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              role="progressbar"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {progress > 0 ? `${Math.round(progress)}%` : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AudioDownloadStatus;