import React, { useState, useEffect } from "react";
import { Container, Form, Button, Spinner, Alert } from "react-bootstrap";

interface CeleryTaskResponse {
  status: string;
  error?: string;
}

/**
 * Компонент для скачивания фрагмента YouTube-видео
 * используя эндпоинты /download_fragment и /download_fragment_result/:task_id
 */
const DownloadFragment: React.FC = () => {
  const [videoUrl, setVideoUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:00");

  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(""); // Храним состояние задачи (PENDING, SUCCESS, FAILURE и т.д.)
  const [error, setError] = useState<string>(""); // Для отображения ошибок

  // Флаг, показывающий, идёт ли сейчас обработка
  const isProcessing = taskId && status !== "SUCCESS" && status !== "FAILURE";

  // Обработчик нажатия "Submit"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setTaskId(null);

    // Валидируйте при желании перед отправкой
    if (!videoUrl.trim()) {
      setError("Необходимо ввести ссылку на видео");
      return;
    }

    const token = localStorage.getItem("access_token"); // если JWT-токен храните в localStorage
    const payload = {
      video_url: videoUrl,
      start_time: startTime,
      end_time: endTime,
    };

    try {
      const response = await fetch("/api/download_fragment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Если у вас стоит @jwt_required()
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const respText = await response.text();
        throw new Error(
          `Запрос на /download_fragment вернул статус ${response.status}: ${respText}`
        );
      }

      const data = await response.json();
      // Ожидаем, что придёт { "message": "Задача инициирована", "task_id": "..."}
      if (data.task_id) {
        setTaskId(data.task_id);
        setStatus("PENDING");
      } else {
        throw new Error("Не получен task_id из ответа сервера.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Эффект для пулинга статуса задачи, пока не SUCCESS/FAILURE
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const pollTaskStatus = async () => {
      if (!taskId) return;

      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`/api/download_fragment_result/${taskId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        // Если задача ещё не готова, сервер ответит 202 и вернёт "PENDING" или "STARTED"
        // Если SUCCESS -> вернёт файл (или попытается отдать файл).
        // Но мы можем проверять res.status или брать JSON, если это не файл.
        // Чтобы различать, нужно проверить content-type.
        // Можно договориться, что при PENDING/FAILURE сервер возвращает JSON,
        // а при SUCCESS — сразу файл. В таком случае fetch его поймает
        // как blob или начнёт скачивание. Это усложняет.
        //
        // Проще договориться, что для статуса забирать JSON, а для скачивания
        // сделать отдельную кнопку <a href="/api/download_fragment_result/{taskId}" download>.
        //
        // Проверяем код ответа:
        if (res.status === 202) {
          // Сервер вернул JSON со статусом.
          const data: CeleryTaskResponse = await res.json();
          setStatus(data.status); // PENDING, STARTED...
        } else if (res.status === 200) {
          // Значит SUCCESS и в ответ летит сам файл.
          // Но fetch его попытается сразу скачать как blob.
          // Мы можем просто считать, что если 200, то всё готово -> показываем кнопку
          setStatus("SUCCESS");
          if (intervalId) {
            clearInterval(intervalId);
          }
        } else if (res.status === 400 || res.status === 404) {
          // FAILURE или файл не найден
          const data: CeleryTaskResponse = await res.json();
          setStatus("FAILURE");
          setError(data.error || "Ошибка при скачивании");
          if (intervalId) {
            clearInterval(intervalId);
          }
        } else {
          // Иные статусы
          const data = await res.json();
          setStatus(data.status || "UNKNOWN");
        }
      } catch (err: any) {
        console.error("Ошибка при запросе статуса задачи:", err);
        setError(err.message);
        setStatus("FAILURE");
        if (intervalId) {
          clearInterval(intervalId);
        }
      }
    };

    if (taskId && status !== "SUCCESS" && status !== "FAILURE") {
      intervalId = setInterval(pollTaskStatus, 3000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [taskId, status]);

  return (
    <Container className="my-4">
      <h1>Вырезать фрагмент YouTube-видео</h1>
      <Form onSubmit={handleSubmit} className="mb-3">
        <Form.Group controlId="videoUrl" className="mb-3">
          <Form.Label>Ссылка на YouTube</Form.Label>
          <Form.Control
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </Form.Group>

        <Form.Group controlId="startTime" className="mb-3">
          <Form.Label>Время начала (HH:MM:SS)</Form.Label>
          <Form.Control
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="00:00:00"
          />
        </Form.Group>

        <Form.Group controlId="endTime" className="mb-3">
          <Form.Label>Время конца (HH:MM:SS)</Form.Label>
          <Form.Control
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="00:00:00"
          />
        </Form.Group>

        <Button type="submit" variant="primary" disabled={isProcessing}>
          {isProcessing ? "Обработка..." : "Submit"}
        </Button>
      </Form>

      {/* Отображаем ошибку, если есть */}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Если задача в процессе — показываем Spinner + статус */}
      {isProcessing && (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" role="status" />
          <div>Идёт обработка… Текущий статус: {status}</div>
        </div>
      )}

      {/* Если SUCCESS — показываем кнопку/ссылку на скачивание */}
      {status === "SUCCESS" && taskId && (
        <Alert variant="success">
          <p>Фрагмент готов к скачиванию!</p>
          <p>
            <a
              href={`/api/download_fragment_result/${taskId}`}
              download
              className="btn btn-success"
            >
              Скачать фрагмент
            </a>
          </p>
        </Alert>
      )}
    </Container>
  );
};

export default DownloadFragment;
