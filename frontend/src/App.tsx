// src/App.tsx
import { Routes, Route, Link } from "react-router-dom";
import FindChannel from "./pages/FindChannel";
import ChannelPlayListsList from "./pages/ChannelPlayListsList";
import ChannelPlayLists from "./pages/ChannelPlayLists";
import PlayListsVideos from "./pages/PlayListsVideos";
import VideoDetails from "./pages/VideoDetails";
import HomePage from "./pages/HomePage";
import ChannelVideos from "./pages/ChannelVideos";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import { Navbar, Nav, Container } from "react-bootstrap";
import PrivateRoute from "./components/PrivateRoute";
import DownloadFragment from "./pages/DownloadFragment";
import UserDownloads from "./pages/UserDownloads";
import DownloadAudio from "./pages/DownloadAudio";
import DownloadVideo from "./pages/DownloadVideo";
const App = () => {
  return (
    <>
      {/* Navigation Bar */}
      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">
            YouTube Explorer
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/FindChannel">
                Find Channels
              </Nav.Link>
              <Nav.Link as={Link} to="/ChannelPlayListsList">
                Channel PlayLists
              </Nav.Link>
              <Nav.Link as={Link} to="/VideoDetails">
                Video Details
              </Nav.Link>
              <Nav.Link as={Link} to="/profile">
                Profile
              </Nav.Link>
              <Nav.Link as={Link} to="/login">
                Sing In
              </Nav.Link>
              <Nav.Link as={Link} to="/register">
                Sing Up
              </Nav.Link>
              <Nav.Link as={Link} to="/DownloadVideo">
                DownloadVideo
              </Nav.Link>
              <Nav.Link as={Link} to="/DownloadAudio">
                DownloadAudio
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Routing Configuration */}
      <Routes>
        {/* Home Route */}
        <Route path="/" element={<HomePage />} />

        {/* Find Channels */}
        <Route path="/FindChannel" element={<FindChannel />} />

        {/* Channel Playlists List */}
        <Route
          path="/ChannelPlayListsList"
          element={<ChannelPlayListsList />}
        />

        {/* Channel Playlists based on channel_id */}
        <Route
          path="/ChannelPlayLists/:channel_id"
          element={<ChannelPlayLists />}
        />

        {/* Channel Videos based on channel_id */}
        <Route path="/ChannelVideos/:channel_id" element={<ChannelVideos />} />

        {/* Playlist Videos */}
        <Route
          path="/PlayListsVideos/:playlistId"
          element={<PlayListsVideos />}
        />

        {/* Video Details */}
        <Route path="/VideoDetails/:videoId" element={<VideoDetails />} />

        {/* Catch-all route for undefined paths */}
        <Route
          path="*"
          element={<p className="text-center mt-5">Page Not Found</p>}
        />
        {/* Route for Video Details */}
        <Route path="/VideoDetails" element={<VideoDetails />} />
        {/* Dynamic Route: Video Details with Video ID */}
        <Route path="/VideoDetails/:videoId" element={<VideoDetails />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<PrivateRoute />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/DownloadVideo" element={<DownloadVideo />} />
          <Route path="/DownloadAudio" element={<DownloadAudio />} />
          <Route path="/editor" element={<DownloadFragment />} />

          {/* Добавьте другие защищённые маршруты здесь */}
        </Route>
      </Routes>
    </>
  );
};

export default App;
