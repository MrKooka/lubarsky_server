// src/hooks/useChannelPlayLists.ts
import { useState, useEffect } from "react";

type Playlist = {
  id: string;
  title: string;
  description: string;
  picture?: string;
};

export function useChannelPlayLists(channelId: string | null, maxResults: number = 10) {
  const [playLists, setPlayLists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!channelId) {
      setPlayLists([]);
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
          `http://127.0.0.1:5000/youtube/get_channel_playlists/${channelId}?max_results=${maxResults}`
        );
        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }
        const data: Playlist[] = await response.json();
        if (isMounted) {
          setPlayLists(data);
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
  console.log("playLists:", playLists);
  
  return { playLists, loading, error };
}

export default useChannelPlayLists;
