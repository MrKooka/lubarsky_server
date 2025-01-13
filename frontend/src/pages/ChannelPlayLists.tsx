// src/pages/ChannelPlayLists.tsx
import { useParams, Link } from "react-router-dom"; // Import useParams
import useChannelPlayLists from "../hooks/useChannelPlayLists";
import {
  Button,
  Card,
  Spinner,
  Alert,
  Container,
  Row,
  Col,
} from "react-bootstrap";

const ChannelPlayLists = () => {
  const { channel_id } = useParams<{ channel_id: string }>(); // Get channel_id from URL
  const { playLists, loading, error } = useChannelPlayLists(channel_id, 10);

  if (!channel_id) {
    return (
      <Container className="my-4">
        <Alert variant="danger">Channel ID is missing in the URL.</Alert>
      </Container>
    );
  }

  return (
    <Container className="my-4">
      <h1 className="mb-4">Channel PlayLists</h1>

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

      {/* PlayLists Display */}
      {playLists && playLists.length > 0 && (
        <Row>
          {playLists.map((playlist) => (
            <Col md={4} className="mb-4" key={playlist.id}>
              <Card className="h-100">
                {/* Playlist Thumbnail */}
                {playlist.picture ? (
                  <img
                    src={playlist.picture}
                    className="card-img-top"
                    alt={playlist.title}
                    style={{ height: "180px", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="card-img-top bg-secondary d-flex align-items-center justify-content-center"
                    style={{ height: "180px", color: "#fff" }}
                  >
                    No Image Available
                  </div>
                )}

                <div className="card-body d-flex flex-column">
                  {/* Playlist Title */}
                  <h5 className="card-title">{playlist.title}</h5>
                  {/* Playlist ID */}
                  <p className="card-text">Playlist ID: {playlist.id}</p>
                  {/* Playlist Description */}
                  <p className="card-text">{playlist.description}</p>

                  {/* Link to the Playlist's Videos Page */}
                  <Button
                    as={Link as any}
                    to={`/PlayListsVideos/${playlist.id}`}
                    className="mt-auto"
                    variant="primary"
                  >
                    View Playlist Videos
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* No PlayLists Found */}
      {!loading && !error && playLists.length === 0 && (
        <Alert variant="info" className="my-4">
          No playlists found for this channel.
        </Alert>
      )}
    </Container>
  );
};

export default ChannelPlayLists;
