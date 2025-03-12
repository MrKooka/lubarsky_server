// hooks/useVideoApi.js
import { useState } from "react";

export function useVideoApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Получаем токен авторизации
  const getToken = () => localStorage.getItem("access_token");

  // Получаем доступные форматы видео
  const getVideoFormats = async (videoUrl) => {
    if (!videoUrl) return { formats: [], videoTitle: "" };

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/video_qualities?video_url=${encodeURIComponent(videoUrl)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      return {
        formats: data.formats || [],
        videoTitle: data.video_title || "",
      };
    } catch (err) {
      setError(err.message);
      return { formats: [], videoTitle: "" };
    } finally {
      setIsLoading(false);
    }
  };

  // Запускаем процесс скачивания
  const startVideoDownload = async (videoUrl, formatId) => {
    if (!videoUrl || !formatId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/download_video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          video_url: videoUrl,
          format_id: formatId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      return data.task_id;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Скачиваем готовый файл
  const downloadVideoFile = async (taskId) => {
    if (!taskId) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/get_downloaded_video/${taskId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Получаем имя файла из заголовков
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "video.mp4";

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);

      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  const getDownloadedVideo = async (taskId) => {
    if (!taskId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/get_downloaded_video/${taskId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "video.mp4";

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Возвращаем blob и имя файла, а создавать ссылку и скачивать будем уже в компоненте
      return { blob, filename };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const cutVideo = async (taskId, startTime, endTime, deleteOriginal) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cut_video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          task_id: taskId,
          start_time: startTime,     // зависит от того, как на сервере ожидают
          end_time: endTime,         // может быть в секундах или в формате HH:MM:SS
          delete_original: deleteOriginal,
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
  
      // Сервер должен вернуть новый task_id или сообщение об успехе
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getFragmentVideo = async (taskId) => {
    if (!taskId) return null;
  
    setIsLoading(true);
    setError(null);
  
    try {
      const response = await fetch(`/api/get_fragment/${taskId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
  
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
  
      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "fragment.mp4";
  
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
  
      return { blob, filename };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    isLoading,
    error,
    getVideoFormats,
    startVideoDownload,
    downloadVideoFile,  // старый метод «прямого скачивания»
    getDownloadedVideo, // новый метод
    cutVideo,
    getFragmentVideo
  };
}