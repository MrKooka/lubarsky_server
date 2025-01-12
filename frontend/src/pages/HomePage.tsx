// src/pages/HomePage.tsx
import Input from "../components/Input";
import { useFetchChannelVideos } from "../hooks/useFetchChannelVideos";

function HomePage() {
  const channelId = "UCpakYOycn3O5W5S50l-0VIg";
  const { videos, loading, error } = useFetchChannelVideos(channelId, 10);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <Input></Input>
      <h1>Channel Videos</h1>
      <ul>
        {videos.map((video) => (
          <li key={video.video_id}>
            {video.title} <br />
            <img src={video.thumbnail_url} alt={video.title} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HomePage;
