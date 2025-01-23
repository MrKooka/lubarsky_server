// src/pages/VideoDetails.tsx
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Button,
  Card,
  Spinner,
  Alert,
  Container,
  Row,
  Col,
  ProgressBar,
} from "react-bootstrap";

import Input from "../components/Input";
import useFetchVideoDetails from "../hooks/useFetchVideoDetails";

// Описание структуры ответа от эндпоинта /task_status/<task_id>:
interface CeleryTaskStatusResponse {
  status: string; // например, "PROGRESS", "SUCCESS", "FAILURE", "done", ...
  meta?: {
    progress?: number; // 0..100, если Celery передаёт
    step?: string; // "downloading", "compress_audio", "transcribing", ...
  };
  // Когда задача SUCCESS, обычно в result лежит итог:
  result?: {
    transcription?: string;
    videoId?: string;
  };
  info?: string; // на случай ошибок
}

// Описание структуры ответа от POST /transcript
interface TranscriptPostResponse {
  // Если транскрипт уже готов и есть в БД:
  transcript?: string;
  videoId?: string;
  // Если нет транскрипта, но мы запустили Celery-цепочку:
  triger_download_task_id?: string;
  transcribe_audio_task_id?: string;
  // Или просто статус (например, "downloading", "transcribing")
  status?: string;
  created_at?: string;
}

// Для параметров URL (пример: /VideoDetails/:videoId)
interface RouteParams {
  videoId?: string;
}

const VideoDetails: React.FC = () => {
  // 1. Извлекаем videoId из URL (пример: "/VideoDetails/abc123")
  const { videoId } = useParams();

  // Локальное состояние: "какое видео мы сейчас смотрим"
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(
    videoId || null
  );

  // 2. Подгружаем детали о видео (заголовок, описание, постер и т.д.)
  //    используя ваш кастомный хук useFetchVideoDetails.
  const { videoDetails, loading, error } = useFetchVideoDetails(currentVideoId);

  // 3. Состояния для механизма транскрипции:
  //    (ID задач, прогресс, статус, итоговый текст)
  const [trigerDownloadTaskId, setTrigerDownloadTaskId] = useState<
    string | null
  >(null);
  const [transcribeAudioTaskId, setTranscribeAudioTaskId] = useState<
    string | null
  >(null);

  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");

  // Определяем, идёт ли процесс (для показа спиннера/прогресс-бара).
  const isLoadingProcess = Boolean(
    (trigerDownloadTaskId || transcribeAudioTaskId) && statusText !== "done"
  );

  // 4. При изменении URL-параметра обновляем currentVideoId
  useEffect(() => {
    if (videoId) {
      setCurrentVideoId(videoId);
    }
  }, [videoId]);

  // Вспомогательная функция: извлекает videoId из пользовательской ссылки
  // (Если пользователю нужно вбить URL вручную)
  const extractVideoId = (url: string): string | null => {
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Если хотим дать пользователю поле ввода для "Enter YouTube Video URL":
  // когда он сабмитит, мы пытаемся извлечь ID (или ругаемся).
  const handleVideoLinkSubmit = (link: string) => {
    const extractedId = extractVideoId(link);
    if (extractedId) {
      setCurrentVideoId(extractedId);
    } else {
      alert("Invalid YouTube URL. Please enter a valid link.");
    }
  };

  // 5. Кнопка "Transcript": шлём POST /transcript (передаём ПОЛНУЮ ссылку)
  const handleTranscript = async () => {
    if (!currentVideoId) return;

    // Сбрасываем прежние данные о процессе:
    setTranscript("");
    setProgress(0);
    setStatusText("");
    setTrigerDownloadTaskId(null);
    setTranscribeAudioTaskId(null);

    try {
      // Собираем полную ссылку, если у нас только videoId
      // Например: "https://www.youtube.com/watch?v=XXXX"
      const fullUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;

      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: fullUrl }),
      });
      if (!response.ok) {
        throw new Error(`Ошибка: ${response.statusText}`);
      }

      const data: TranscriptPostResponse = await response.json();

      // 5.1 Если уже есть готовая транскрипция (состояние "done" в БД):
      if (data.transcript) {
        setTranscript(data.transcript);
        setStatusText("done");
        setProgress(100);
        return;
      }

      // 5.2 Если вернулись две задачи => значит процесс запущен:
      if (data.triger_download_task_id && data.transcribe_audio_task_id) {
        setTrigerDownloadTaskId(data.triger_download_task_id);
        setTranscribeAudioTaskId(data.transcribe_audio_task_id);
        // Начинаем процесс => пусть статус будет "downloading"
        setStatusText("downloading");
        setProgress(0);
        return;
      }

      // 5.3 Если вернулся status (например, "downloading"), но нет текста:
      if (data.status && data.status !== "done") {
        setStatusText(data.status);
        setProgress(10); // приблизительно, что "уже идёт"
        return;
      }

      // fallback:
      setStatusText("Неизвестный ответ сервера при POST /transcript");
    } catch (err: any) {
      console.error("handleTranscript error:", err);
      setStatusText(`Ошибка: ${err.message}`);
    }
  };

  // 6. useEffect для поллинга статуса Celery-задач
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const pollStatus = async () => {
      // 6.1 Проверяем статус задачи скачивания (triger_download_task_id)
      if (trigerDownloadTaskId) {
        try {
          const res = await fetch(`/api/task_status/${trigerDownloadTaskId}`);
          if (!res.ok) {
            throw new Error(`Статус скачивания: ${res.statusText}`);
          }
          const data: CeleryTaskStatusResponse = await res.json();

          if (data.status === "PROGRESS") {
            if (data.meta?.progress !== undefined) {
              setProgress(data.meta.progress);
            }
            if (data.meta?.step) {
              setStatusText(data.meta.step);
            }
          } else if (data.status === "SUCCESS" || data.status === "done") {
            // Считаем, что скачивание = ок
            // Допустим, выставим 50%
            setProgress(50);
            setStatusText("Скачивание завершено, идёт транскрибация…");
          } else if (data.status === "FAILURE") {
            setStatusText("Ошибка при скачивании");
            if (intervalId) clearInterval(intervalId);
            return;
          }
        } catch (err: any) {
          console.error("Ошибка при статусе скачивания:", err.message);
        }
      }

      // 6.2 Проверяем статус задачи транскрибации (transcribe_audio_task_id)
      if (transcribeAudioTaskId) {
        try {
          const res = await fetch(`/api/task_status/${transcribeAudioTaskId}`);
          if (!res.ok) {
            throw new Error(`Статус транскрибации: ${res.statusText}`);
          }
          const data: CeleryTaskStatusResponse = await res.json();

          if (data.status === "PROGRESS") {
            if (data.meta?.progress !== undefined) {
              setProgress(data.meta.progress);
            }
            if (data.meta?.step) {
              setStatusText(data.meta.step);
            }
          } else if (data.status === "SUCCESS" || data.status === "done") {
            // Готово => забираем транскрипт
            if (data.result?.transcription) {
              setTranscript(data.result.transcription);
            }
            setProgress(100);
            setStatusText("done");
            if (intervalId) clearInterval(intervalId);
          } else if (data.status === "FAILURE") {
            setStatusText("Ошибка при транскрибации");
            if (intervalId) clearInterval(intervalId);
            return;
          }
        } catch (err: any) {
          console.error("Ошибка при статусе транскрибации:", err.message);
        }
      }
    };

    // Если есть taskId, запускаем интервал опроса
    if (trigerDownloadTaskId || transcribeAudioTaskId) {
      intervalId = setInterval(pollStatus, 3000);
    }

    // Чистим интервал при размонтировании
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [trigerDownloadTaskId, transcribeAudioTaskId]);

  // -- Рендер --
  return (
    <Container className="my-4">
      <h1 className="mb-4">Video Details</h1>

      {/* Поле ввода URL (если нужно вручную ввести ссылку) */}
      <Input
        onSubmitChannelId={handleVideoLinkSubmit}
        placeholder="Enter YouTube Video URL"
      />

      {/* Показать загрузку для info о видео (из useFetchVideoDetails) */}
      {loading && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" role="status">
            <span className="visually-hidden">Loading Video Info...</span>
          </Spinner>
        </div>
      )}

      {/* Ошибка при загрузке Video Details */}
      {error && (
        <Alert variant="danger" className="my-4">
          {error}
        </Alert>
      )}

      {/* Если есть данные о видео -> показываем карточку */}
      {videoDetails && (
        <Card className="my-4">
          <Row className="g-0">
            <Col md={4}>
              {videoDetails.thumbnail_url ? (
                <Card.Img
                  src={videoDetails.thumbnail_url}
                  alt={videoDetails.title}
                  style={{ height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  className="bg-secondary d-flex align-items-center justify-content-center"
                  style={{ height: "100%", color: "#fff" }}
                >
                  No Image Available
                </div>
              )}
            </Col>
            <Col md={8}>
              <Card.Body>
                <Card.Title>{videoDetails.title}</Card.Title>
                <Card.Text>{videoDetails.description}</Card.Text>
                <Card.Text>
                  <strong>Published At:</strong>{" "}
                  {new Date(videoDetails.published_at).toLocaleDateString()}
                </Card.Text>
                <Card.Text>
                  <strong>Channel:</strong> {videoDetails.channel_title} (
                  <Link to={`/ChannelVideos/${videoDetails.channel_id}`}>
                    {videoDetails.channel_id}
                  </Link>
                  )
                </Card.Text>
                <Card.Text>Duration: {videoDetails.duration}</Card.Text>
                {/* Кнопка "Transcript", запускаем Celery-процесс */}
                <Button
                  variant="primary"
                  onClick={handleTranscript}
                  disabled={isLoadingProcess} // чтобы не жать повторно
                >
                  {isLoadingProcess ? "Processing..." : "Transcript"}
                </Button>
              </Card.Body>
            </Col>
          </Row>
        </Card>
      )}

      {/* Если идёт процесс -> показываем ПрогрессБар и статус */}
      {isLoadingProcess && (
        <div style={{ marginBottom: "1rem" }}>
          <Alert variant="info">Текущий статус: {statusText || "…"}</Alert>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Transcribing...</span>
            </Spinner>
            <ProgressBar
              now={progress}
              label={`${progress}%`}
              style={{ flex: 1 }}
            />
          </div>
          <p>
            Подождите, пожалуйста. Процесс может занять несколько минут
            (скачивание, сжатие, транскрибация).
          </p>
        </div>
      )}

      {/* Когда процесс done, покажем транскрипт */}
      {statusText === "done" && transcript && (
        <Card className="my-4">
          <Card.Header>Transcript</Card.Header>
          <Card.Body>
            <Card.Text style={{ whiteSpace: "pre-wrap" }}>
              {transcript}
            </Card.Text>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default VideoDetails;
