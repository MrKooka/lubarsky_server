// src/hooks/useChannelPlayLists.ts

import { useState, useEffect } from "react";

type Playlist = {
  id: string;
  title: string;
  description: string;
  picture?: string;
};

export function useChannelPlayLists(channelId: string | undefined, maxResults: number = 10) {
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
          `/api/youtube/get_channel_playlists/${channelId}?max_results=${maxResults}`
        );
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to fetch playlists");
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

  return { playLists, loading, error };
}

export default useChannelPlayLists;
