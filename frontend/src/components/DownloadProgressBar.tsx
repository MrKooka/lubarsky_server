// components/DownloadProgressBar.js
import React, { useState, useEffect } from "react";

function DownloadProgressBar({ taskId, onDownloadComplete }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [step, setStep] = useState(""); // Добавляем шаг загрузки
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) return;

    const checkProgress = async () => {
      try {
        const token = localStorage.getItem("access_token");
        // Исправляем URL для вашего API
        const response = await fetch(`/api/download_video_status/${taskId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // Используем поле percent вместо progress
        setProgress(data.percent || 0);
        setStatus(data.status || "");
        setStep(data.step || "");

        // Проверяем статус "completed", "SUCCESS" или "DONE"
        if (
          data.status === "completed" ||
          data.status === "SUCCESS" ||
          data.status === "DONE"
        ) {
          if (onDownloadComplete) {
            onDownloadComplete();
          }
          return true;
        }

        return false;
      } catch (err) {
        console.error("Progress check error:", err);
        setError(err.message);
        return true; // Остановить опрос при ошибке
      }
    };

    // Инициируем первую проверку немедленно
    checkProgress();

    const interval = setInterval(async () => {
      const shouldStop = await checkProgress();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [taskId, onDownloadComplete]);

  return (
    <div>
      {error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <>
          <div className="progress mb-3">
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {progress}%
            </div>
          </div>
          <p className="text-center">Status: {status}</p>
          {step && <p className="text-center">Step: {step}</p>}
        </>
      )}
    </div>
  );
}

export default DownloadProgressBar;
