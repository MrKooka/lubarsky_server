import React, { useState } from "react";
import DownloadProgressBar from "../components/DownloadProgressBar";

function DownloadFragment() {
  const [videoUrl, setVideoUrl] = useState("");
  const [formats, setFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [taskId, setTaskId] = useState(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);

  // 1) Отправляем ссылку, получаем список форматов
  const handleSubmitUrl = async () => {
    if (!videoUrl) return;

    setIsLoading(true);
    setFormats([]);
    setSelectedFormat("");
    setTaskId(null);
    setIsDownloadComplete(false);

    const token = localStorage.getItem("access_token");

    try {
      const response = await fetch(
        `/api/video_qualities?video_url=${encodeURIComponent(videoUrl)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        console.error("Error getting formats:", response.status);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      setFormats(data.formats || []);
      setVideoTitle(data.video_title || "");
      setIsLoading(false);
    } catch (err) {
      console.error("Error while requesting formats:", err);
      setIsLoading(false);
    }
  };

  // 2) Выбираем формат
  const handleSelectFormat = (e) => {
    const formatId = e.target.value;
    setSelectedFormat(formatId);
  };

  // 3) Запускаем скачивание и получаем task_id
  const handleDownload = async () => {
    if (!videoUrl || !selectedFormat) return;

    const token = localStorage.getItem("access_token");

    try {
      const response = await fetch("/api/download_video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          video_url: videoUrl,
          format_id: selectedFormat,
        }),
      });

      if (!response.ok) {
        console.error("error starting download:", response.status);
        return;
      }

      const data = await response.json();
      setTaskId(data.task_id);
      setIsDownloadComplete(false);
    } catch (err) {
      console.error("Error while requesting download_video:", err);
    }
  };

  // Обработчик для завершения загрузки
  const handleDownloadComplete = () => {
    setIsDownloadComplete(true);
  };

  // Скачивание файла
  const handleDownloadFile = async () => {
    if (!taskId) return;

    const token = localStorage.getItem("access_token");

    try {
      // Создаем временный элемент <a> для скачивания с заголовком авторизации
      const response = await fetch(`/api/get_downloaded_video/${taskId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`error while downloading: ${response.status}`);
      }

      // Получаем blob данные из ответа
      const blob = await response.blob();

      // Создаем URL для скачивания
      const downloadUrl = window.URL.createObjectURL(blob);

      // Создаем ссылку и автоматически кликаем по ней
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Название файла можно взять из заголовков, если сервер его отправляет
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "video.mp4"; // Имя по умолчанию

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Removing a link from the DOM
      document.body.removeChild(link);

      // Freeing the URL object
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);
    } catch (err) {
      console.error("Error downloading file:", err);
      alert("Failed to download file. Details in console.");
    }
  };

  return (
    <div className="container mt-4">
      <h3>Download video</h3>

      {/* 1)Link input field and button */}
      <div className="mb-3">
        <label className="form-label">Link to video</label>
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="input video link"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={handleSubmitUrl}
            disabled={isLoading || !videoUrl}
          >
            {isLoading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Loading...
              </>
            ) : (
              "Получить форматы"
            )}
          </button>
        </div>
      </div>

      {/* 2) Display spinner on boot */}
      {isLoading && (
        <div className="text-center my-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Getting Available Formats...</p>
        </div>
      )}

      {/* 3)Display formats (if any) */}
      {!isLoading && formats.length > 0 && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="mb-0">Available formats for: {videoTitle}</h5>
          </div>
          <div className="card-body">
            <select
              className="form-select mb-3"
              onChange={handleSelectFormat}
              value={selectedFormat}
            >
              <option value="">-- Select format --</option>
              {formats.map((f) => (
                <option key={f.format_id} value={f.format_id}>
                  {f.resolution} ({f.format_id})
                </option>
              ))}
            </select>

            {/* 4) Button Submit */}
            <button
              className="btn btn-success"
              onClick={handleDownload}
              disabled={!selectedFormat}
            >
              Download selected format
            </button>
          </div>
        </div>
      )}

      {/* 5) Show progress bar if taskId is received*/}
      {taskId && !isDownloadComplete && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="mb-0">Loading progress</h5>
          </div>
          <div className="card-body">
            <DownloadProgressBar
              taskId={taskId}
              onDownloadComplete={handleDownloadComplete}
            />
          </div>
        </div>
      )}

      {/* 6) Кнопка скачивания после успешной загрузки */}
      {isDownloadComplete && (
        <div className="card mt-4 border-success">
          <div className="card-header bg-success text-white">
            <h5 className="mb-0">Loading completed</h5>
          </div>
          <div className="card-body text-center">
            <p className="mb-3">
              The video has been successfully uploaded and is ready for
              download.
            </p>
            <button
              className="btn btn-lg btn-primary"
              onClick={handleDownloadFile}
            >
              <i className="bi bi-download me-2"></i> Download video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DownloadFragment;
