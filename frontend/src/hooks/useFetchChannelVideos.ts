// src/hooks/useFetchChannelVideos.ts
import { useState, useEffect } from "react";

type Video = {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url?: string;
};

export function useFetchChannelVideos(channelId: string, maxResults: number = 10) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`http://localhost:5000/youtube/fetch_channel_videos/${channelId}?max_results=${maxResults}`);
        if (!response.ok) {
            
          throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
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
  }, [channelId, maxResults]);

  return { videos, loading, error };
}

export default useFetchChannelVideos