import Input from "./components/Input";
import HomePage from "./pages/HomePage";
import { Routes, Route } from "react-router-dom";
import ChannelVideos from "./pages/ChannelVideos";
import ChannelPlayLists from "./pages/ChannelPlayLists";
import PlayListsVideos from "./pages/PlayListsVideos";
import { Link } from "react-router-dom";
const App = () => {
  return (
    <div>
      <h1>App</h1>
      <nav style={{ display: "flex", gap: "1rem" }}>
        <Link to="/ChannelVideos" className="link-secondary">
          ChannelVideos
        </Link>
        <Link to="/ChannelPlayLists" className="link-secondary">
          ChannelPlayLists
        </Link>
        <Link to="/PlayListsVideos" className="link-secondary">
          PlayListsVideos
        </Link>
      </nav>

      <Routes>
        {/* Route for the Home page */}
        <Route path="/ChannelVideos" element={<ChannelVideos />} />

        {/* Route for the About page */}
        <Route path="/ChannelPlayLists" element={<ChannelPlayLists />} />

        {/* Catch-all route for 404 / Not Found */}
        <Route
          path="/PlayListsVideos/:playlistId"
          element={<PlayListsVideos />}
        />
      </Routes>
    </div>
  );
};

export default App;
