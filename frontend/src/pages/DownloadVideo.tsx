import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useVideoApi } from "../hooks/useVideoApi";
import FormatSelector from "../components/FormatSelector";
import UrlInput from "../components/UrlInput";
import DownloadStatus from "../components/DownloadStatus";

function DownloadVideo() {
  const [videoUrl, setVideoUrl] = useState("");
  const [formats, setFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [taskId, setTaskId] = useState(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);
  const navigate = useNavigate();

  const {
    isLoading,
    error,
    getVideoFormats,
    startVideoDownload,
  } = useVideoApi(); // Убрал downloadVideoFile из деструктуризации

  // Автоматический редирект после завершения загрузки
  useEffect(() => {
    if (isDownloadComplete && taskId) {
      // Небольшая задержка перед редиректом, чтобы пользователь успел заметить, что загрузка завершена
      const redirectTimer = setTimeout(() => {
        navigate(`/editor?taskId=${taskId}`);
      }, 1000); // 1 секунда задержки

      return () => clearTimeout(redirectTimer);
    }
  }, [isDownloadComplete, taskId, navigate]);

  // 1) Отправляем ссылку, получаем список форматов
  const handleSubmitUrl = async () => {
    if (!videoUrl) return;

    setFormats([]);
    setSelectedFormat("");
    setTaskId(null);
    setIsDownloadComplete(false);

    const result = await getVideoFormats(videoUrl);
    setFormats(result.formats);
    setVideoTitle(result.videoTitle);
  };

  // 2) Выбираем формат
  const handleSelectFormat = (e) => {
    setSelectedFormat(e.target.value);
  };

  // 3) Запускаем скачивание
  const handleDownload = async () => {
    const newTaskId = await startVideoDownload(videoUrl, selectedFormat);
    if (newTaskId) {
      setTaskId(newTaskId);
      setIsDownloadComplete(false);
    }
  };

  // 4) Обработчик завершения загрузки
  const handleDownloadComplete = () => {
    setIsDownloadComplete(true);
    // Редирект происходит автоматически благодаря useEffect выше
  };

  return (
    <div className="container mt-4">
      <h3>Download video</h3>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <UrlInput
        url={videoUrl}
        setUrl={setVideoUrl}
        onSubmit={handleSubmitUrl}
        isLoading={isLoading}
      />

      {isLoading && !formats.length && (
        <div className="text-center my-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Getting Available Formats...</p>
        </div>
      )}

      <FormatSelector
        formats={formats}
        selectedFormat={selectedFormat}
        onChange={handleSelectFormat}
        videoTitle={videoTitle}
        onDownload={handleDownload}
      />

      <DownloadStatus
        taskId={taskId}
        isComplete={isDownloadComplete}
        onDownloadComplete={handleDownloadComplete}
        mediaType="Video"
        apiEndpoint="download_video_status"
        // Убран проп onDownloadClick, чтобы не было возможности скачать файл
      />

      {isDownloadComplete && taskId && (
        <div className="card mt-4">
          <div className="card-header bg-info text-white">
            <h5 className="mb-0">Redirecting to Video Editor...</h5>
          </div>
          <div className="card-body text-center">
            <div className="spinner-border text-info" role="status">
              <span className="visually-hidden">Redirecting...</span>
            </div>
            <p className="mt-3">You will be redirected to the video editor in a moment.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DownloadVideo;