import React, { useState } from "react";
import { useAudioApi } from "../hooks/useAudioApi";
import UrlInput from "../components/UrlInput";
import DownloadStatus from "../components/DownloadStatus";

function DownloadAudio() {
  const [audioUrl, setAudioUrl] = useState("");
  const [taskId, setTaskId] = useState(null);
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);

  const { isLoading, error, startAudioDownload, downloadAudioFile } =
    useAudioApi();

  // Запускаем скачивание аудио
  const handleDownloadAudio = async () => {
    if (!audioUrl) return;

    setTaskId(null);
    setIsDownloadComplete(false);

    const newTaskId = await startAudioDownload(audioUrl);
    if (newTaskId) {
      setTaskId(newTaskId);
    }
  };

  // Обработчик завершения загрузки
  const handleDownloadComplete = () => {
    setIsDownloadComplete(true);
  };

  // Скачивание файла после завершения
  const handleDownloadFile = async () => {
    await downloadAudioFile(taskId);
  };

  return (
    <div className="container mt-4">
      <h3>Download Audio</h3>
      <p className="text-muted">
        Extract audio from YouTube or other supported links
      </p>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <UrlInput
        url={audioUrl}
        setUrl={setAudioUrl}
        onSubmit={handleDownloadAudio}
        isLoading={isLoading}
        label="Link to audio"
        placeholder="Input YouTube or other link"
        buttonText="Download Audio"
      />

      <DownloadStatus
        taskId={taskId}
        isComplete={isDownloadComplete}
        onDownloadClick={handleDownloadFile}
        onDownloadComplete={handleDownloadComplete}
        mediaType="Audio"
        apiEndpoint="download_audio_status"
      />

      {!taskId && !isLoading && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="mb-0">How to use</h5>
          </div>
          <div className="card-body">
            <ol>
              <li>Paste a link to a YouTube video or other supported URL</li>
              <li>Click "Download Audio" to start the extraction process</li>
              <li>Wait for the process to complete</li>
              <li>
                Click "Download Audio" to save the audio file to your device
              </li>
            </ol>
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              Audio will be extracted in the best available quality.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DownloadAudio;
