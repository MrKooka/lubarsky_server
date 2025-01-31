// src/pages/UserDownloads.tsx
import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Button,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";

interface DownloadFragmentItem {
  id: number;
  video_url: string;
  start_time: string;
  end_time: string;
  fragment_path: string;
  created_at: string;
}

const UserDownloads: React.FC = () => {
  const [downloads, setDownloads] = useState<DownloadFragmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate(); // Хук для перенаправления

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          // Если токен отсутствует, перенаправляем на /login
          navigate("/login");
          return;
        }

        const response = await fetch("/api/user_downloads", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          // Если токен недействителен или отсутствует, перенаправляем на /login
          navigate("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(`Ошибка при загрузке списка: ${response.statusText}`);
        }

        const data = await response.json();

        // Предполагаем, что бекенд возвращает объект с ключом 'downloads'
        // Если он возвращает просто массив, используйте 'data || []'
        setDownloads(data.downloads || data);
      } catch (err: any) {
        setError(err.message || "Произошла неизвестная ошибка");
      } finally {
        setLoading(false);
      }
    };

    fetchDownloads();
  }, [navigate]);

  // Функция для скачивания файла
  const handleDownload = async (id: number) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch(`/api/download_fragment_result/${id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        navigate("/login");
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка при скачивании файла: ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Определяем имя файла. Можно извлечь из 'fragment_path' или использовать другой подход.
      const filename = `fragment_${id}${getFileExtension(response)}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Ошибка при скачивании файла.");
    }
  };

  // Вспомогательная функция для определения расширения файла
  const getFileExtension = (response: Response): string => {
    const disposition = response.headers.get("Content-Disposition");
    if (disposition && disposition.includes("filename=")) {
      const filename = disposition
        .split("filename=")[1]
        .split(";")[0]
        .replace(/"/g, "");
      return `.${filename.split(".").pop()}`;
    }
    // Если заголовок Content-Disposition отсутствует или не содержит filename, используем .mp4 по умолчанию
    return ".mp4";
  };

  if (loading) {
    return (
      <Container className="my-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Загрузка...</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="my-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="my-4">
      <h1>Мои скачанные видео</h1>

      {downloads.length === 0 ? (
        <Alert variant="info">Вы ещё не скачивали фрагменты видео.</Alert>
      ) : (
        <Row xs={1} md={2} lg={3} className="g-4">
          {downloads.map((item) => (
            <Col key={item.id}>
              <Card>
                <Card.Body>
                  <Card.Title>
                    <a
                      href={item.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {extractVideoTitle(item.video_url)}
                    </a>
                  </Card.Title>
                  <Card.Text>
                    <strong>Начало:</strong> {item.start_time},{" "}
                    <strong>Конец:</strong> {item.end_time}
                  </Card.Text>
                  <Card.Text>
                    <strong>Загрузили:</strong>{" "}
                    {new Date(item.created_at).toLocaleString()}
                  </Card.Text>
                </Card.Body>
                <Card.Footer>
                  <Button
                    variant="primary"
                    onClick={() => handleDownload(item.id)}
                  >
                    Скачать файл
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
};

// Вспомогательная функция для извлечения заголовка видео из URL (опционально)
const extractVideoTitle = (url: string): string => {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/;
  const match = url.match(regex);
  return match ? `Видео ID: ${match[1]}` : "Неизвестное видео";
};

export default UserDownloads;
