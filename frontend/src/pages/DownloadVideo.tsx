import React, { useState } from "react";
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
    downloadVideoFile,
  } = useVideoApi();

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
  };

  // 5) Скачивание файла после завершения
  const handleDownloadFile = async () => {
    await downloadVideoFile(taskId);
  };

  // 6) Обработчик для перехода на страницу редактирования
  const handleCutVideo = () => {
    if (taskId) {
      navigate(`/editor?taskId=${taskId}`);
    }
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
        onDownloadClick={handleDownloadFile}
        onDownloadComplete={handleDownloadComplete}
        mediaType="Video"
        apiEndpoint="download_video_status"
      />

      {/* Кнопка Cut появляется только после завершения загрузки */}
      {isDownloadComplete && taskId && (
        <div className="card mt-4">
          <div className="card-header bg-info text-white">
            <h5 className="mb-0">Video editing options</h5>
          </div>
          <div className="card-body text-center">
            <p className="mb-3">
              You can now edit your downloaded video or cut segments from it.
            </p>
            <button className="btn btn-info" onClick={handleCutVideo}>
              <i className="bi bi-scissors me-2"></i> Cut Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DownloadVideo;
