// components/SilentVideoDownloadStatus.jsx
import React, { useState, useEffect } from "react";

function SilentVideoDownloadStatus({
  taskId,
  isComplete,
  onDownloadClick,
  onDownloadComplete,
  apiEndpoint,
}) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Опрос статуса
  useEffect(() => {
    if (!taskId || isComplete) return;

    const pollInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`/api/${apiEndpoint}/${taskId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error checking status: ${response.status}`);
        }

        const data = await response.json();
        
        // Устанавливаем статус из API
        setStatus(data.status);
        
        // Если есть прогресс, обновляем
        if (data.percent !== undefined) {
          setProgress(data.percent);
        }

        // Обработка завершения
        if (data.status === "SUCCESS") {
          setLoading(false);
          onDownloadComplete();
        } else if (data.status === "FAILURE") {
          setLoading(false);
          setError(data.error || "Failed to process silent video");
        }
      } catch (err) {
        setLoading(false);
        setError(err.message);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [taskId, isComplete, apiEndpoint, onDownloadComplete]);

  if (error) {
    return (
      <div className="alert alert-danger">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center">
        <div className="me-3">
          <i className="bi bi-volume-mute-fill fs-4"></i>
        </div>
        <div className="flex-grow-1">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span>
              <strong>Silent Video:</strong>{" "}
              {isComplete
                ? "Ready to download"
                : status === "PENDING"
                ? "Starting..."
                : status === "PROGRESS"
                ? `Processing ${progress ? `(${progress}%)` : ""}`
                : "Preparing..."}
            </span>
            {isComplete && (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={onDownloadClick}
              >
                <i className="bi bi-download me-1"></i>
                Download
              </button>
            )}
          </div>
          {!isComplete && (
            <div className="progress">
              <div
                className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                style={{ width: `${progress || 10}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SilentVideoDownloadStatus;