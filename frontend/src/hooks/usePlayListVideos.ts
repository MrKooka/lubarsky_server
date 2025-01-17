// src/hooks/usePlayListVideos.ts
import { useState, useEffect } from "react";

type Video = {
  video_id: string;
  title: string;
  description: string;
  thumbnail_url?: string;
  published_at: string;
};

interface UsePlayListVideosResult {
  videos: Video[];
  loading: boolean;
  error: string | null;
}

export function usePlayListVideos(
  playlistId: string | null,
  maxResults: number = 10
): UsePlayListVideosResult {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playlistId) {
      // If no playlistId is set, reset the state
      setVideos([]);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/youtube/fetch_playlist_videos/${playlistId}?max_results=${maxResults}`
        );
        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }
        const data: Video[] = await response.json();
        if (isMounted) {
          setVideos(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [playlistId, maxResults]);

  return { videos, loading, error };
}

export default usePlayListVideos;
