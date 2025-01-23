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
import AddTranscriptButton from "../components/AddTranscriptButton";

// Описание структур...
interface CeleryTaskStatusResponse {
  status: string;
  meta?: {
    progress?: number;
    step?: string;
  };
  result?: {
    transcription?: string;
    videoId?: string;
  };
  info?: string;
}

interface TranscriptPostResponse {
  transcript?: string;
  videoId?: string;
  triger_download_task_id?: string;
  transcribe_audio_task_id?: string;
  status?: string;
  created_at?: string;
  already_linked?: boolean;
}

interface VideoDetailsType {
  video_id: string;
  title: string;
  description: string;
  published_at: string;
  channel_id: string;
  channel_title: string;
  category_id: string;
  thumbnail_url: string | null;
  tags: string[];
  duration: string;
  dimension: string;
  definition: string;
  caption: boolean;
  licensed_content: boolean;
  projection: string;
  view_count: number;
  like_count: number;
  dislike_count: number;
  favorite_count: number;
  comment_count: number;
  privacy_status: string;
  license: string;
  embeddable: boolean;
  public_stats_viewable: boolean;
}

const VideoDetails: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(
    videoId || null
  );
  const { videoDetails, loading, error } = useFetchVideoDetails(currentVideoId);

  const [trigerDownloadTaskId, setTrigerDownloadTaskId] = useState<
    string | null
  >(null);
  const [transcribeAudioTaskId, setTranscribeAudioTaskId] = useState<
    string | null
  >(null);

  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [isAlreadyLinked, setIsAlreadyLinked] = useState<boolean>();
  const isLoadingProcess = Boolean(
    (trigerDownloadTaskId || transcribeAudioTaskId) && statusText !== "done"
  );

  useEffect(() => {
    if (videoId) {
      setCurrentVideoId(videoId);
    }
  }, [videoId]);

  const extractVideoId = (url: string): string | null => {
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const handleVideoLinkSubmit = (link: string) => {
    const extractedId = extractVideoId(link);
    if (extractedId) {
      setCurrentVideoId(extractedId);
    } else {
      alert("Invalid YouTube URL. Please enter a valid link.");
    }
  };

  const handleTranscript = async () => {
    if (!currentVideoId || !videoDetails) return;
    const token = localStorage.getItem("access_token");

    // Сбрасываем прежние данные о процессе:
    setTranscript("");
    setProgress(0);
    setStatusText("");
    setTrigerDownloadTaskId(null);
    setTranscribeAudioTaskId(null);

    try {
      const fullUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;

      const payload = {
        video_url: fullUrl,
        video_id: videoDetails.video_id,
        title: videoDetails.title,
        description: videoDetails.description,
        published_at: videoDetails.published_at,
        channel_id: videoDetails.channel_id,
        channel_title: videoDetails.channel_title,
        category_id: videoDetails.category_id,
        thumbnail_url: videoDetails.thumbnail_url,
        tags: videoDetails.tags,
        duration: videoDetails.duration,
        dimension: videoDetails.dimension,
        definition: videoDetails.definition,
        caption: videoDetails.caption,
        licensed_content: videoDetails.licensed_content,
        projection: videoDetails.projection,
        view_count: videoDetails.view_count,
        like_count: videoDetails.like_count,
        dislike_count: videoDetails.dislike_count,
        favorite_count: videoDetails.favorite_count,
        comment_count: videoDetails.comment_count,
        privacy_status: videoDetails.privacy_status,
        license: videoDetails.license,
        embeddable: videoDetails.embeddable,
        public_stats_viewable: videoDetails.public_stats_viewable,
      };

      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Ошибка: ${response.statusText}`);
      }

      const data: TranscriptPostResponse = await response.json();
      if (data.already_linked) {
        setIsAlreadyLinked(true);
      }
      if (data.transcript) {
        setTranscript(data.transcript);
        setStatusText("done");
        setProgress(100);
        return;
      }

      if (data.triger_download_task_id && data.transcribe_audio_task_id) {
        setTrigerDownloadTaskId(data.triger_download_task_id);
        setTranscribeAudioTaskId(data.transcribe_audio_task_id);
        setStatusText("downloading");
        setProgress(0);
        return;
      }

      if (data.status && data.status !== "done") {
        setStatusText(data.status);
        setProgress(10);
        return;
      }

      setStatusText("Неизвестный ответ сервера при POST /transcript");
    } catch (err: any) {
      console.error("handleTranscript error:", err);
      setStatusText(`Ошибка: ${err.message}`);
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const pollStatus = async () => {
      if (trigerDownloadTaskId) {
        try {
          const res = await fetch(`/api/task_status/${trigerDownloadTaskId}`);
          if (!res.ok) {
            throw new Error(`Статус скачивания: ${res.statusText}`);
          }
          const data: CeleryTaskStatusResponse = await res.json();

          if (data.status === "PROGRESS") {
            const progress = data.meta?.progress;
            if (progress !== undefined) {
              setProgress((prev) => Math.min(prev, progress));
            }
            if (data.meta?.step) {
              setStatusText(data.meta.step);
            }
          } else if (data.status === "SUCCESS" || data.status === "done") {
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

      if (transcribeAudioTaskId) {
        try {
          const res = await fetch(`/api/task_status/${transcribeAudioTaskId}`);
          if (!res.ok) {
            throw new Error(`Статус транскрибации: ${res.statusText}`);
          }
          const data: CeleryTaskStatusResponse = await res.json();

          if (data.status === "PROGRESS") {
            const progress = data.meta?.progress;
            if (progress !== undefined) {
              setProgress(50 + (progress / 100) * 50);
            }
            if (data.meta?.step) {
              setStatusText(data.meta.step);
            }
          } else if (data.status === "SUCCESS" || data.status === "done") {
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

    if (trigerDownloadTaskId || transcribeAudioTaskId) {
      intervalId = setInterval(pollStatus, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [trigerDownloadTaskId, transcribeAudioTaskId]);

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
              label={`${Math.round(progress)}%`}
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
