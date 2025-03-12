// DownloadFragment.jsx
import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UrlInput from "../components/UrlInput";
import DownloadStatus from "../components/DownloadStatus";
import { useVideoApi } from "../hooks/useVideoApi";
import useTimeControls from "../hooks/useTimeControls";
import VideoControls from "../components/VideoControls";
import VideoPlayer from "../components/VideoPlayer";
import TimeEditor from "../components/TimeEditor";

function DownloadFragment() {
  // -- Оригинальный taskId (полное видео)
  const [originalTaskId, setOriginalTaskId] = useState(null);

  // -- Для отображения полного видео
  const [originalVideoBlob, setOriginalVideoBlob] = useState(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState("");

  // -- Поля для заголовка видео
  const [videoTitle, setVideoTitle] = useState("");

  // -- Флаг, что полное видео загрузилось успешно
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);

  // -- Стандартные состояния
  const [mediaUrl, setMediaUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // -- Удалять ли оригинальный файл на сервере после обрезки
  const [deleteOriginal, setDeleteOriginal] = useState(false);

  // -- Управление плеером (start/end time)
  const videoRef = useRef(null);
  const timeControls = useTimeControls(videoRef);

  // -- Для опроса extract_fragment_status
  const [fragmentTaskId, setFragmentTaskId] = useState(null);
  const [fragmentStatus, setFragmentStatus] = useState("IDLE");
  // Возможные значения: "IDLE" | "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE"

  // -- Хук API
  const api = useVideoApi();

  // -- React Router
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTaskId = queryParams.get("taskId");

  // ===========================
  // useEffect: Если ?taskId=... уже есть, грузим полное видео
  // ===========================
  useEffect(() => {
    if (initialTaskId) {
      setOriginalTaskId(initialTaskId);
      setIsDownloadComplete(true);
      loadOriginalVideo(initialTaskId);
    }
  }, [initialTaskId]);

  // ===========================
  // Очистка objectURL при размонтировании
  // ===========================
  useEffect(() => {
    return () => {
      if (originalVideoUrl) {
        URL.revokeObjectURL(originalVideoUrl);
      }
    };
  }, [originalVideoUrl]);

  // ===========================
  // Функция загрузки полного видео (GET /get_downloaded_video/<taskId>)
  // ===========================
  const loadOriginalVideo = async (someTaskId) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getDownloadedVideo(someTaskId);
      if (!result) {
        throw new Error("No original file returned");
      }
      const blobUrl = URL.createObjectURL(result.blob);
      setOriginalVideoBlob(result.blob);
      setOriginalVideoUrl(blobUrl);
      setVideoTitle(result.filename || "video.mp4");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================
  // Кнопка "Download and Edit"
  // ===========================
  const handleDownloadVideo = async () => {
    if (!mediaUrl) return;
    setIsLoading(true);
    setError(null);
    setIsDownloadComplete(false);

    // сброс старых данных
    setOriginalTaskId(null);
    setOriginalVideoBlob(null);
    setOriginalVideoUrl("");
    setVideoTitle("");

    try {
      const data = await api.downloadVideo(mediaUrl); // POST /download_video
      if (data?.task_id) {
        setOriginalTaskId(data.task_id);
        navigate(`/editor?taskId=${data.task_id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================
  // Кнопка "Cut Video"
  // ===========================
  const handleCutVideo = async () => {
    if (!originalTaskId) return;
    if (timeControls.startTime >= timeControls.endTime) {
      alert("Start time >= End time!");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // 1) Запускаем POST /cut_video
      const data = await api.cutVideo(
        originalTaskId,
        timeControls.startTime,
        timeControls.endTime,
        deleteOriginal
      );
      if (!data || !data.task_id) {
        throw new Error("No fragment task_id returned from cutVideo");
      }
      const newFragId = data.task_id;
      setFragmentTaskId(newFragId);
      setFragmentStatus("PENDING"); // начнём polling статуса

      // 2) Запускаем опрос extract_fragment_status
      pollExtractFragmentStatus(newFragId);

      // (не меняем URL, чтобы не перезагружать full-video)
      // Если хотите, можно вызвать navigate(`/editor?taskId=${newFragId}`).

      // Просто уведомим:
      console.log("Cut video started, new fragmentId =", newFragId);
    } catch (err) {
      setError(err.message);
      setFragmentTaskId(null);
      setFragmentStatus("FAILURE");
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================
  // Функция polling для /extract_fragment_status
  // ===========================
  const pollExtractFragmentStatus = async (taskId) => {
    let attempts = 0;
    const maxAttempts = 30;
    const pollInterval = 2000;

    async function checkStatus() {
      try {
        const resp = await fetch(`/api/extract_fragment_status/${taskId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        });
        if (!resp.ok) {
          setFragmentStatus("FAILURE");
          return;
        }

        const data = await resp.json();
        if (data.status === "SUCCESS") {
          setFragmentStatus("SUCCESS");
          return; // Останавиваем polling (нет setTimeout)
        }
        if (data.status === "FAILURE") {
          setFragmentStatus("FAILURE");
          return; // Останавливаем
        }

        // Если PENDING или PROGRESS
        setFragmentStatus(data.status);

        // Проверяем, не превысили ли мы максимальное кол-во попыток
        attempts++;
        if (attempts < maxAttempts) {
          // Продолжаем polling
          setTimeout(checkStatus, pollInterval);
        } else {
          // Выходим по timeout
          setFragmentStatus("FAILURE");
        }
      } catch (err) {
        console.error("Poll error:", err);
        setFragmentStatus("FAILURE");
      }
    }

    checkStatus();
  };

  // ===========================
  // Непосредственное скачивание "полного" видео
  // ===========================
  const downloadFullVideo = () => {
    if (!originalVideoBlob || !originalVideoUrl) {
      alert("No original video loaded.");
      return;
    }
    const a = document.createElement("a");
    a.href = originalVideoUrl;
    a.download = videoTitle || "full_video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ===========================
  // Скачивание обрезанного файла (GET /get_fragment/<fragmentTaskId>)
  // ===========================
  const downloadFragmentVideo = async () => {
    if (!fragmentTaskId) {
      alert("No fragmentTaskId");
      return;
    }
    // Сервер отдаёт сам файл
    try {
      setIsLoading(true);
      const resp = await fetch(`/api/get_fragment/${fragmentTaskId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      if (!resp.ok) {
        throw new Error(`get_fragment error: ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "fragment.mp4";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Error downloading fragment: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================
  // Обработка статуса download_video (целого файла)
  // ===========================
  const onDownloadComplete = () => {
    setIsDownloadComplete(true);
    if (originalTaskId) {
      loadOriginalVideo(originalTaskId);
    }
  };

  // ===========================
  // Выбираем, какое видео показывать в плеере
  // ===========================
  // В этом примере мы всегда показываем только «полное» видео.
  // Если хотите, можете автоматически грузить обрезанный blob,
  // когда fragmentStatus=SUCCESS. Тут пока не делаем.
  const finalVideoUrl = originalVideoUrl;

  // ===========================
  // JSX
  // ===========================
  return (
    <div className="container mt-4">
      <h3>Video Editor</h3>
      <p className="text-muted">Cut and edit videos directly in your browser</p>

      {/* Ошибки */}
      {error && (
        <div className="alert alert-danger mb-3">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Показываем taskId оригинала, если есть */}
      {originalTaskId && (
        <div className="alert alert-info mb-2">
          <small>Original Task ID: {originalTaskId}</small>
        </div>
      )}

      {/* Показываем taskId фрагмента, если уже есть */}
      {fragmentTaskId && (
        <div className="alert alert-warning mb-2">
          <small>Fragment Task ID: {fragmentTaskId}</small>
        </div>
      )}

      {/* Ввод URL (если нет initialTaskId) */}
      {!initialTaskId && !originalTaskId && (
        <UrlInput
          url={mediaUrl}
          setUrl={setMediaUrl}
          onSubmit={handleDownloadVideo}
          isLoading={isLoading}
          label="Link to video"
          placeholder="Input video link (YouTube, etc.)"
          buttonText="Download and Edit"
        />
      )}

      {/* DownloadStatus для целого видео */}
      {originalTaskId && !isDownloadComplete && (
        <DownloadStatus
          taskId={originalTaskId}
          isComplete={isDownloadComplete}
          onDownloadClick={() => {}}
          onDownloadComplete={onDownloadComplete}
          mediaType="Video"
          apiEndpoint="download_video_status"
        />
      )}

      {/* Спиннер, если общий isLoading == true и пока нет готового видео */}
      {isLoading && !finalVideoUrl && (
        <div className="text-center my-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading video...</p>
        </div>
      )}

      {/* Если есть полноценный videoUrl, показываем плеер */}
      {finalVideoUrl && (
        <div className="card mt-4">
          <VideoPlayer
            videoRef={videoRef}
            videoUrl={finalVideoUrl}
            videoTitle={videoTitle}
            onLoadedMetadata={timeControls.handleLoadedMetadata}
            onTimeUpdate={timeControls.handleTimeUpdate}
          />

          <div className="card-footer">
            {/* Редактор времени */}
            <TimeEditor
              startTime={timeControls.startTime}
              endTime={timeControls.endTime}
              currentTime={timeControls.currentTime}
              duration={timeControls.duration}
              startTimeValues={timeControls.startTimeValues}
              endTimeValues={timeControls.endTimeValues}
              isEditingStartTime={timeControls.isEditingStartTime}
              isEditingEndTime={timeControls.isEditingEndTime}
              formatTime={timeControls.formatTime}
              onSetStartTime={timeControls.setCurrentAsStartTime}
              onSetEndTime={timeControls.setCurrentAsEndTime}
              onChangeStartTime={timeControls.handleStartTimeChange}
              onChangeEndTime={timeControls.handleEndTimeChange}
              onConfirmStartTime={timeControls.confirmStartTime}
              onConfirmEndTime={timeControls.confirmEndTime}
            />

            {/* Кнопки управления */}
            <VideoControls
              startTime={timeControls.startTime}
              endTime={timeControls.endTime}
              isLoading={isLoading}
              deleteOriginal={deleteOriginal}
              onDeleteOriginalChange={setDeleteOriginal}
              onPreviewSegment={timeControls.previewSegment}
              // Кнопка "Download" для полного видео
              onDownloadVideo={downloadFullVideo}
              // Кнопка "Cut Video"
              onCutVideo={handleCutVideo}
            />
          </div>
        </div>
      )}

      {/* Блок «Статус обрезки» с возможным спиннером 
          Когда fragmentStatus = PENDING/PROGRESS -> показываем индикатор
          Когда fragmentStatus = SUCCESS -> показываем кнопку Download Fragment
      */}
      {fragmentTaskId && (
        <div className="mt-3 p-3 border rounded">
          <h5>Cut fragment status:</h5>

          {(fragmentStatus === "PENDING" || fragmentStatus === "PROGRESS") && (
            <div className="d-flex align-items-center">
              <div className="spinner-border text-success me-2" role="status" />
              <span>Processing fragment...</span>
            </div>
          )}

          {fragmentStatus === "FAILURE" && (
            <div className="text-danger">
              Error occurred while cutting fragment. See logs.
            </div>
          )}

          {fragmentStatus === "SUCCESS" && (
            <button className="btn btn-success" onClick={downloadFragmentVideo}>
              Download Fragment
            </button>
          )}
        </div>
      )}

      {/* Если ничего не запущено, показываем инструкцию */}
      {!initialTaskId && !originalTaskId && !isLoading && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="mb-0">How to use</h5>
          </div>
          <div className="card-body">
            <ol>
              <li>Paste a link to a video you want to edit</li>
              <li>Click "Download and Edit" to start the download</li>
              <li>Wait for the process to complete</li>
              <li>Use the video player to pick start and end times</li>
              <li>
                Click <b>Cut Video</b> to create fragment
              </li>
              <li>
                A spinner will show while the server is cutting. Once done, a{" "}
                <b>Download Fragment</b> button appears.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default DownloadFragment;
