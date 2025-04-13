// hooks/useAudioApi.js
import { useState } from 'react';

export function useAudioApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Получаем токен авторизации
  const getToken = () => localStorage.getItem("access_token");

  // Запускаем скачивание аудио
  const startAudioDownload = async (audioUrl) => {
    if (!audioUrl) return null;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/download_audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          video_url: audioUrl,
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

  // Скачиваем готовый аудиофайл
  const downloadAudioFile = async (taskId) => {
    if (!taskId) return false;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/get_downloaded_audio/${taskId}`, {
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
      let filename = "audio.mp3";

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

  const startAudioDownload_from_player_page = async (videoUrlOrTaskId) => {
    if (!videoUrlOrTaskId) return null;
    
    setIsLoading(true);
    setError(null);

    try {
      let requestBody = {};
      
      // Определяем, что нам передали: URL или task_id
      if (videoUrlOrTaskId.startsWith('http')) {
        // Это URL
        requestBody = { video_url: videoUrlOrTaskId };
      } else {
        // Это task_id
        requestBody = { task_id: videoUrlOrTaskId };
      }

      const response = await fetch("/api/download_audio_from_player_page", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(requestBody),
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

  // Скачиваем готовый аудиофайл
  const downloadAudioFile_from_player_page = async (taskId) => {
    if (!taskId) return false;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/get_downloaded_audio_from_player_page/${taskId}`, {
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
      let filename = "audio.mp3";

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
  
  return {
    isLoading,
    error,
    startAudioDownload,
    downloadAudioFile,
    startAudioDownload_from_player_page,
    downloadAudioFile_from_player_page
  };
}
