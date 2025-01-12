// src/services/api.ts

export async function fetchChannelVideos(channelId: string, maxResults: number = 10) {
    const url = `http://localhost:5000/youtube/fetch_channel_videos/${channelId}?max_results=${maxResults}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching channel videos: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data; // This would be an array of video objects
  }
  