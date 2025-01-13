// src/App.tsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import FindChannel from "./pages/FindChannel";
import ChannelPlayListsList from "./pages/ChannelPlayListsList";
import ChannelPlayLists from "./pages/ChannelPlayLists";
import PlayListsVideos from "./pages/PlayListsVideos";
import VideoDetails from "./pages/VideoDetails";
import HomePage from "./pages/HomePage";
import ChannelVideos from "./pages/ChannelVideos";
import { Navbar, Nav, Container } from "react-bootstrap";

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
      </Routes>
    </>
  );
};

export default App;
