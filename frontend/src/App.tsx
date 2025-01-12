// src/App.tsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import ChannelVideos from "./pages/ChannelVideos";
import ChannelPlayLists from "./pages/ChannelPlayLists";
import PlayListsVideos from "./pages/PlayListsVideos";
import VideoDetails from "./pages/VideoDetails";
import HomePage from "./pages/HomePage"; // Ensure you have a HomePage component
import { Navbar, Nav, Container } from "react-bootstrap"; // Using Bootstrap components

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
              <Nav.Link as={Link} to="/ChannelVideos">
                Channel Videos
              </Nav.Link>
              <Nav.Link as={Link} to="/ChannelPlayLists">
                Channel PlayLists
              </Nav.Link>
              <Nav.Link as={Link} to="/PlayListsVideos">
                PlayLists Videos
              </Nav.Link>
              <Nav.Link as={Link} to="/VideoDetails">
                Video Details
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Routing Configuration */}
      <Routes>
        {/* Home Route */}
        <Route path="/" element={<HomePage />} />

        {/* Route for Channel Videos */}
        <Route path="/ChannelVideos" element={<ChannelVideos />} />
        {/* Optional: Channel Videos with Channel ID */}
        <Route path="/ChannelVideos/:channelId" element={<ChannelVideos />} />

        {/* Route for Channel PlayLists */}
        <Route path="/ChannelPlayLists" element={<ChannelPlayLists />} />
        {/* Dynamic Route: Channel PlayLists with Channel ID */}
        <Route
          path="/ChannelPlayLists/:channelId"
          element={<ChannelPlayLists />}
        />

        {/* Route for PlayLists Videos */}
        <Route path="/PlayListsVideos" element={<PlayListsVideos />} />
        {/* Dynamic Route: PlayLists Videos with Playlist ID */}
        <Route
          path="/PlayListsVideos/:playlistId"
          element={<PlayListsVideos />}
        />

        {/* Route for Video Details */}
        <Route path="/VideoDetails" element={<VideoDetails />} />
        {/* Dynamic Route: Video Details with Video ID */}
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
