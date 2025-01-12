// src/hooks/useSearchChannels.ts
import { useState, useEffect } from "react";

type Channel = {
  channel_id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
};

interface UseSearchChannelsResult {
  channels: Channel[];
  loading: boolean;
  error: string | null;
}

const useSearchChannels = (handle: string | null): UseSearchChannelsResult => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setChannels([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchChannels = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://127.0.0.1:5000/youtube/search_channel?handle=${encodeURIComponent(handle)}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to fetch channels");
        }
        const data: Channel[] = await response.json();
        setChannels(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [handle]);

  return { channels, loading, error };
};

export default useSearchChannels;
