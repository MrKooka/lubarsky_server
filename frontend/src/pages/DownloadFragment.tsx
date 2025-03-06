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

  // Для времени начала (часы, минуты, секунды)
  const [startHour, setStartHour] = useState("00");
  const [startMinute, setStartMinute] = useState("00");
  const [startSecond, setStartSecond] = useState("00");

  // Для времени конца (часы, минуты, секунды)
  const [endHour, setEndHour] = useState("00");
  const [endMinute, setEndMinute] = useState("00");
  const [endSecond, setEndSecond] = useState("00");

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

    // Восстановим время в формате HH:MM:SS
    const startTime = `${startHour.padStart(2, "0")}:${startMinute.padStart(
      2,
      "0"
    )}:${startSecond.padStart(2, "0")}`;
    const endTime = `${endHour.padStart(2, "0")}:${endMinute.padStart(
      2,
      "0"
    )}:${endSecond.padStart(2, "0")}`;

    // Простая валидация
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

        if (res.status === 202) {
          // Сервер вернул JSON со статусом PENDING/STARTED
          const data: CeleryTaskResponse = await res.json();
          setStatus(data.status); // PENDING, STARTED...
        } else if (res.status === 200) {
          // Значит SUCCESS и в ответ летит сам файл
          setStatus("SUCCESS");
          if (intervalId) {
            clearInterval(intervalId);
          }
        } else if (res.status === 400 || res.status === 404) {
          // Скорее всего FAILURE
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

        {/* Время начала: три отдельных поля (часы, минуты, секунды) */}
        <Form.Group controlId="startTimeGroup" className="mb-3">
          <Form.Label>Время начала</Form.Label>
          <div className="d-flex gap-2">
            <Form.Control
              size="sm"
              type="text"
              placeholder="HH"
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
              style={{ width: "60px" }}
            />
            <Form.Control
              size="sm"
              type="text"
              placeholder="MM"
              value={startMinute}
              onChange={(e) => setStartMinute(e.target.value)}
              style={{ width: "60px" }}
            />
            <Form.Control
              size="sm"
              type="text"
              placeholder="SS"
              value={startSecond}
              onChange={(e) => setStartSecond(e.target.value)}
              style={{ width: "60px" }}
            />
          </div>
        </Form.Group>

        <Form.Group controlId="endTimeGroup" className="mb-3">
          <Form.Label>Время конца</Form.Label>
          <div className="d-flex gap-2">
            <Form.Control
              size="sm"
              type="text"
              placeholder="HH"
              value={endHour}
              onChange={(e) => setEndHour(e.target.value)}
              style={{ width: "60px" }}
            />
            <Form.Control
              size="sm"
              type="text"
              placeholder="MM"
              value={endMinute}
              onChange={(e) => setEndMinute(e.target.value)}
              style={{ width: "60px" }}
            />
            <Form.Control
              size="sm"
              type="text"
              placeholder="SS"
              value={endSecond}
              onChange={(e) => setEndSecond(e.target.value)}
              style={{ width: "60px" }}
            />
          </div>
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
