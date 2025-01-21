// src/pages/VideoDetails.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import Input from "../components/Input";
import useFetchVideoDetails from "../hooks/useFetchVideoDetails";
import {
  Button,
  Card,
  Spinner,
  Alert,
  Container,
  Row,
  Col,
} from "react-bootstrap";

const POLLING_INTERVAL = 3000; // 3 секунды

const VideoDetails: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(
    videoId || null
  );
  const { videoDetails, loading, error } = useFetchVideoDetails(currentVideoId);

  // Здесь храним task_ids, статусы и расшифровку:
  const [trigerDownloadTaskId, setTrigerDownloadTaskId] = useState<
    string | null
  >(null);
  const [transcribeAudioTaskId, setTranscribeAudioTaskId] = useState<
    string | null
  >(null);
  const [taskStatus, setTaskStatus] = useState<string>("");
  const [transcript, setTranscript] = useState<string | null>(null);

  // При смене URL-параметра тоже обновляем текущее видео.
  useEffect(() => {
    if (videoId) {
      setCurrentVideoId(videoId);
    }
  }, [videoId]);

  // Отправляем полную ссылку на flask_app:5500/transcript
  const handleTranscript = async () => {
    if (!videoDetails || !videoDetails.video_id) return;

    // Собираем ПОЛНУЮ ссылку. Предположим, что у нас шаблон: https://www.youtube.com/watch?v=VIDEO_ID
    // Либо пользователь введёт руками, если нужен другой источник.
    const fullYouTubeUrl = `https://www.youtube.com/watch?v=${videoDetails.video_id}`;

    // Сбрасываем старые значения:
    setTranscript(null);
    setTrigerDownloadTaskId(null);
    setTranscribeAudioTaskId(null);
    setTaskStatus("Starting...");

    try {
      const response = await fetch("http://localhost:5500/transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ video_url: fullYouTubeUrl }),
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();

      // Если API уже вернул расшифровку готовую:
      if (data.transcript) {
        // Значит статус "done"
        setTranscript(data.transcript);
        setTaskStatus("done");
        return;
      }
      // Иначе это объект с task_id:
      setTrigerDownloadTaskId(data.triger_download_task_id);
      setTranscribeAudioTaskId(data.transcribe_audio_task_id);

      // Начинаем опрашивать статусы:
      setTaskStatus("Requesting...");
    } catch (err: any) {
      setTaskStatus(`Error: ${err.message}`);
    }
  };

  // Функция для опроса статуса Celery-задачи по ID
  const fetchTaskStatus = useCallback(
    async (taskId: string): Promise<string> => {
      const res = await fetch(`http://localhost:5500/task_status/${taskId}`);
      if (!res.ok) {
        throw new Error(
          `Failed to fetch status for ${taskId}: ${res.statusText}`
        );
      }
      const data = await res.json();
      return data.status; // Например, "PENDING", "PROGRESS", "SUCCESS", "done", "downloading" и т.д.
    },
    []
  );

  // Для получения результата, если задача SUCCESS:
  const fetchTaskResult = useCallback(async (taskId: string) => {
    const res = await fetch(`http://localhost:5500/task_status/${taskId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch final result for ${taskId}`);
    }
    const data = await res.json();
    return data.result; // В transcribe_audio_task возвращается {transcription, videoId}
  }, []);

  // Когда у нас есть оба task_id, запускаем периодический опрос
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (trigerDownloadTaskId && transcribeAudioTaskId) {
      intervalId = setInterval(async () => {
        try {
          // 1) Сначала спрашиваем статус задачи скачивания:
          const downloadStatus = await fetchTaskStatus(trigerDownloadTaskId);

          if (
            downloadStatus !== "SUCCESS" &&
            downloadStatus !== "FAILURE" &&
            downloadStatus !== "REVOKED" &&
            downloadStatus !== "done"
          ) {
            // Значит ещё идёт скачивание или "compress_audio".
            setTaskStatus(downloadStatus);
            return;
          }

          // Если скачивание успешно (или "done" со стороны Celery),
          // начинаем/продолжаем трекать статус задачи транскрибации:
          const transcribeStatus = await fetchTaskStatus(transcribeAudioTaskId);

          if (transcribeStatus === "SUCCESS" || transcribeStatus === "done") {
            // Запрашиваем финальный результат:
            const finalResult = await fetchTaskResult(transcribeAudioTaskId);
            if (finalResult && finalResult.transcription) {
              setTranscript(finalResult.transcription);
              setTaskStatus("done");
            } else {
              setTaskStatus("No transcription found");
            }
            // Останавливаем опрос
            clearInterval(intervalId);
          } else if (
            transcribeStatus === "FAILURE" ||
            transcribeStatus === "REVOKED"
          ) {
            setTaskStatus("error");
            clearInterval(intervalId);
          } else {
            // Идёт "transcribing"
            setTaskStatus(transcribeStatus);
          }
        } catch (err: any) {
          setTaskStatus(`Error: ${err.message}`);
          clearInterval(intervalId);
        }
      }, POLLING_INTERVAL);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    trigerDownloadTaskId,
    transcribeAudioTaskId,
    fetchTaskStatus,
    fetchTaskResult,
  ]);

  // Пример сабмита URL вручную. Если используете свою логику — оставьте или уберите.
  const handleVideoLinkSubmit = (link: string) => {
    // Если пользователь вводит целиком https://youtu.be/xxxx
    // можно распарсить и установить currentVideoId
    setCurrentVideoId(extractVideoId(link));
  };

  // Утилита извлечения videoId — если потребуется
  const extractVideoId = (url: string): string | null => {
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  return (
    <Container className="my-4">
      <h1 className="mb-4">Video Details</h1>

      <Input
        onSubmitChannelId={handleVideoLinkSubmit}
        placeholder="Enter Full YouTube Video URL"
      />

      {loading && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      {error && (
        <Alert variant="danger" className="my-4">
          {error}
        </Alert>
      )}

      {/* Отображаем данные о видео */}
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

                {/* Кнопка запуска транскрибации */}
                <Button variant="primary" onClick={handleTranscript}>
                  {/* Если есть taskStatus, показываем его, иначе "Transcript" */}
                  {taskStatus ? taskStatus : "Transcript"}
                </Button>
              </Card.Body>
            </Col>
          </Row>
        </Card>
      )}

      {/* Если у нас есть финальная транскрипция */}
      {transcript && (
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
