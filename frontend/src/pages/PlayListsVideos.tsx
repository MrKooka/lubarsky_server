// src/pages/PlayListsVideos.tsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Input from "../components/Input";
import usePlayListVideos from "../hooks/usePlayListVideos";
import { Link } from "react-router-dom"; // Import Link from react-router-dom
import {
  Button,
  Card,
  Spinner,
  Alert,
  Container,
  Row,
  Col,
} from "react-bootstrap";

const PlayListsVideos = () => {
  const { playlistId } = useParams<{ playlistId: string }>();
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(
    playlistId || null
  );
  const { videos, loading, error } = usePlayListVideos(currentPlaylistId, 10);

  const handlePlaylistIdSubmit = (submittedPlaylistId: string) => {
    console.log("User entered playlist ID:", submittedPlaylistId);
    setCurrentPlaylistId(submittedPlaylistId);
  };

  useEffect(() => {
    if (playlistId) {
      setCurrentPlaylistId(playlistId);
    }
  }, [playlistId]);

  return (
    <Container className="my-4">
      <h1 className="mb-4">PlayLists Videos</h1>
      <Input
        onSubmitChannelId={handlePlaylistIdSubmit}
        placeholder="Enter Playlist ID"
      />

      {/* Loading State */}
      {loading && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="danger" className="my-4">
          Error: {error}
        </Alert>
      )}

      {/* Videos Display */}
      {videos && videos.length > 0 && (
        <Row>
          {videos.map((video) => (
            <Col md={6} className="mb-4" key={video.video_id}>
              <Card className="h-100">
                {/* Video Thumbnail */}
                {video.thumbnail_url ? (
                  <Card.Img
                    src={video.thumbnail_url}
                    alt={video.title}
                    style={{ height: "200px", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="bg-secondary d-flex align-items-center justify-content-center"
                    style={{ height: "200px", color: "#fff" }}
                  >
                    No Image Available
                  </div>
                )}

                <Card.Body className="d-flex flex-column">
                  {/* Video Title */}
                  <Card.Title>{video.title}</Card.Title>

                  {/* Video Description */}
                  <Card.Text>Video ID: {video.video_id}</Card.Text>

                  {/* Published Date */}
                  <Card.Text>
                    <small className="text-muted">
                      Published at:{" "}
                      {new Date(video.published_at).toLocaleDateString()}
                    </small>
                  </Card.Text>

                  {/* Video ID as Link to VideoDetails */}
                  <Button
                    as={Link}
                    to={`/VideoDetails/${video.video_id}`}
                    variant="primary"
                    className="mt-auto"
                  >
                    View Video Details
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* No Videos Found */}
      {!loading && !error && currentPlaylistId && videos.length === 0 && (
        <Alert variant="info" className="my-4">
          No videos found for this playlist.
        </Alert>
      )}
    </Container>
  );
};

export default PlayListsVideos;
