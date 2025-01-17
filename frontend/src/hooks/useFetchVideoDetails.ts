// src/hooks/useFetchVideoDetails.ts
import { useState, useEffect } from "react";

type VideoDetails = {
  video_id: string;
  title: string;
  description: string;
  published_at: string;
  channel_id: string;
  channel_title: string;
  category_id: string;
  thumbnail_url: string | null;
  tags: string[];
  duration: string;
  dimension: string;
  definition: string;
  caption: string;
  licensed_content: boolean;
  projection: string;
  view_count: number;
  like_count: number;
  dislike_count: number;
  favorite_count: number;
  comment_count: number;
  privacy_status: string;
  license: string;
  embeddable: boolean;
  public_stats_viewable: boolean;
};

interface UseFetchVideoDetailsResult {
  videoDetails: VideoDetails | null;
  loading: boolean;
  error: string | null;
}

const useFetchVideoDetails = (videoId: string | null): UseFetchVideoDetailsResult => {
  const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) {
      setVideoDetails(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/youtube/fetch_video_details/${videoId}`);
        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }
        const data: VideoDetails = await response.json();
        setVideoDetails(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [videoId]);

  return { videoDetails, loading, error };
};

export default useFetchVideoDetails;
