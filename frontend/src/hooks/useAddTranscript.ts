// frontend/src/hooks/useAddTranscript.ts

import { useState } from "react";

interface UseAddTranscriptReturn {
  addTranscript: (videoId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  success: boolean;
}

export function useAddTranscript(): UseAddTranscriptReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function addTranscript(videoId: string) {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch("/api/add-user-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ video_id: videoId }),
      });

      if (!response.ok) {
        const message = await response.json();
        throw new Error(message?.message || `Error: ${response.status}`);
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { addTranscript, loading, error, success };
}
