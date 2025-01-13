// src/pages/HomePage.tsx
import Input from "../components/Input";
import { useFetchChannelVideos } from "../hooks/useFetchChannelVideos";

function HomePage() {
  const channelId = "UCpakYOycn3O5W5S50l-0VIg";
  // const { videos, loading, error } = useFetchChannelVideos(channelId, 10);

  return (
    <div>
      <h1>Index</h1>
    </div>
  );
}

export default HomePage;
