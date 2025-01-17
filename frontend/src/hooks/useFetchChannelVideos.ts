import { useState, useEffect, useCallback } from "react";

type Video = {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url?: string;
};

interface UseFetchChannelVideosResult {
  videos: Video[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  nextPageToken: string | null;
  loadMore: () => void;
}

export function useFetchChannelVideos(
  channelId: string | undefined,
  maxResults: number = 10,
  maxContent: number = 20
): UseFetchChannelVideosResult {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      // Trigger fetch by updating pageToken
      // Здесь вы можете обновить pageToken, если это необходимо
    }
  }, [loading, hasMore]);

  useEffect(() => {
    if (!channelId) return;

    let isMounted = true;

    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/youtube/fetch_channel_videos/${channelId}?max_results=${maxResults}&pageToken=${pageToken || ""}&max_content=${maxContent}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch videos.");
        }

        const data = await response.json();

        if (isMounted) {
          setVideos((prevVideos) => {
            const updatedVideos = [...prevVideos, ...data.videos];
            setHasMore(data.hasMore && updatedVideos.length < maxContent);
            return updatedVideos;
          });
          setPageToken(data.nextPageToken || null);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchVideos();

    return () => {
      isMounted = false;
    };
  }, [channelId, maxResults, pageToken, maxContent]);

  return { videos, loading, error, hasMore, nextPageToken: pageToken, loadMore };
}

export default useFetchChannelVideos;
