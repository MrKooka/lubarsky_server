import React, { useEffect, useState } from "react";

function DownloadProgressBar({ taskId, onDownloadComplete }) {
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState("PENDING");
  const [step, setStep] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!taskId) return;

    const token = localStorage.getItem("access_token");
    let intervalId;

    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/download_video_status/${taskId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error("Error while requesting task status", response.status);
          setError(`Error while requesting status(${response.status})`);
          return;
        }

        const data = await response.json();
        setPercent(data.percent || 0);
        setStatus(data.status || "");
        setStep(data.step || "");

        // Если есть ошибка в ответе
        if (data.error) {
          setError(data.error);
        }

        // Если статус "SUCCESS", сообщаем о завершении загрузки
        if (data.status === "SUCCESS") {
          if (onDownloadComplete) {
            onDownloadComplete();
          }
          clearInterval(intervalId);
        }

        // Если статус "FAILURE", останавливаем проверку
        if (data.status === "FAILURE") {
          setError(data.error || "There was an error loading");
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error("Error while requesting task status", err);
        setError("Failed to get task status");
      }
    };

    // Начальная проверка
    checkProgress();

    // Регулярная проверка статуса каждые 2 секунды
    intervalId = setInterval(checkProgress, 2000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [taskId, onDownloadComplete]);

  // Определяем класс для прогресс-бара в зависимости от статуса
  const getProgressBarClass = () => {
    if (status === "FAILURE") return "progress-bar bg-danger";
    if (status === "SUCCESS") return "progress-bar bg-success";
    return "progress-bar progress-bar-striped progress-bar-animated";
  };

  // Получаем текст статуса на русском языке
  const getStatusText = () => {
    switch (status) {
      case "PENDING":
        return "Waiting...";
      case "PROGRESS":
        return "downloading...";
      case "SUCCESS":
        return "Completed";
      case "FAILURE":
        return "Error";
      default:
        return status;
    }
  };

  return (
    <div>
      {/* Статус загрузки */}
      <div className="d-flex justify-content-between mb-2">
        <div>
          <strong>Status:</strong> {getStatusText()}
          {step && <span className="text-muted ms-2">({step})</span>}
        </div>
        <div>{percent}%</div>
      </div>

      {/* Прогресс-бар */}
      <div className="progress mb-3" style={{ height: "24px" }}>
        <div
          className={getProgressBarClass()}
          role="progressbar"
          style={{ width: `${percent}%` }}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {percent}%
        </div>
      </div>

      {/* Сообщение об ошибке, если есть */}
      {error && (
        <div className="alert alert-danger mt-2">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

export default DownloadProgressBar;
