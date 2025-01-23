// frontend/src/pages/Profile.tsx
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Spinner,
  Alert,
  Card,
  Button,
} from "react-bootstrap";
import { Link } from "react-router-dom";

// Тип для данных о каждом видео
interface TranscriptedVideo {
  video_id: string;
  title: string;
  description: string;
  status: string;
  published_at: string;
  thumbnail_url: string;
  channel_title: string;
  channel_id: string;
  duration: string;
}

const Profile: React.FC = () => {
  const [videos, setVideos] = useState<TranscriptedVideo[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Загружаем данные о транскрибированных видео
  useEffect(() => {
    const fetchTranscripts = async () => {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      try {
        const response = await fetch("/api/user-transcripts", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка запроса: ${response.statusText}`);
        }

        const data: TranscriptedVideo[] = await response.json();
        setVideos(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTranscripts();
  }, []);

  // Обработка клика по кнопке "Logout"
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  };

  return (
    <Container className="my-4">
      <div className="d-flex justify-content-between align-items-center">
        <h1>Profile</h1>
        <Button variant="danger" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {/* Если идёт загрузка */}
      {loading && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      {/* Ошибка при загрузке */}
      {error && (
        <Alert variant="danger" className="my-4">
          {error}
        </Alert>
      )}

      {/* Если данные загружены, выводим список видео или сообщение, что данных нет */}
      {videos && videos.length > 0
        ? videos.map((video) => (
            <Card className="my-4" key={video.video_id}>
              <Row className="g-0">
                <Col md={4}>
                  {video.thumbnail_url ? (
                    <Card.Img
                      src={video.thumbnail_url}
                      alt={video.title}
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
                    <Card.Title>{video.title}</Card.Title>
                    <Card.Text>{video.description}</Card.Text>
                    <Card.Text>
                      <strong>Status:</strong> {video.status}
                    </Card.Text>
                    <Card.Text>
                      <strong>Published At:</strong>{" "}
                      {new Date(video.published_at).toLocaleDateString()}
                    </Card.Text>
                    <Card.Text>
                      <strong>Channel:</strong> {video.channel_title} (
                      <Link to={`/ChannelVideos/${video.channel_id}`}>
                        {video.channel_id}
                      </Link>
                      )
                    </Card.Text>
                    <Card.Text>
                      <strong>Duration:</strong> {video.duration}
                    </Card.Text>

                    {/* 
                    Дополнительно можно сделать кнопку перехода на страницу деталей
                    если у вас есть отдельный роут /VideoDetails/:videoId
                  */}
                    <Link to={`/VideoDetails/${video.video_id}`}>
                      <Button variant="primary">Подробнее</Button>
                    </Link>
                  </Card.Body>
                </Col>
              </Row>
            </Card>
          ))
        : !loading &&
          !error && (
            <Alert variant="info" className="my-4">
              Нет транскрибированных видео.
            </Alert>
          )}
    </Container>
  );
};

export default Profile;
