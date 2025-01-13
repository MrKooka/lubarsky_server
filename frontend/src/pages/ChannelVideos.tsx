// src/pages/ChannelVideos.tsx

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import useFetchChannelVideos from "../hooks/useFetchChannelVideos";
import {
  Button,
  Card,
  Spinner,
  Alert,
  Container,
  Row,
  Col,
} from "react-bootstrap";
import { useInView } from "react-intersection-observer";

const ChannelVideos = () => {
  const { channel_id } = useParams<{ channel_id: string }>(); // Get channel_id from URL
  const [currentChannelId, setCurrentChannelId] = useState<string | undefined>(
    channel_id
  );
  const { videos, loading, error, hasMore, loadMore } = useFetchChannelVideos(
    currentChannelId,
    10,
    20 // maxContent
  );

  const { ref, inView } = useInView({
    threshold: 0,
  });

  // Load more videos when the sentinel comes into view
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading, loadMore]);

  // Update currentChannelId when URL param changes
  useEffect(() => {
    if (channel_id) {
      setCurrentChannelId(channel_id);
    }
  }, [channel_id]);

  return (
    <Container className="my-4">
      <h1 className="mb-4">Channel Videos</h1>

      {/* Loading State */}
      {loading && videos.length === 0 && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="danger" className="my-4">
          {error}
        </Alert>
      )}

      {/* Videos Display */}
      <Row>
        {videos.map((video, index) => {
          if (videos.length === index + 1) {
            // Attach the ref to the last video element
            return (
              <Col md={4} className="mb-4" key={video.video_id}>
                <Card className="h-100">
                  {video.thumbnail_url ? (
                    <Card.Img
                      src={video.thumbnail_url}
                      alt={video.title}
                      style={{ height: "180px", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="bg-secondary d-flex align-items-center justify-content-center"
                      style={{ height: "180px", color: "#fff" }}
                    >
                      No Image Available
                    </div>
                  )}

                  <Card.Body className="d-flex flex-column">
                    <Card.Title>{video.title}</Card.Title>
                    <Card.Text>
                      Published at:{" "}
                      {new Date(video.published_at).toLocaleDateString()}
                    </Card.Text>

                    <Button
                      as={Link as any}
                      to={`/VideoDetails/${video.video_id}`}
                      variant="primary"
                      className="mt-auto"
                    >
                      View Video Details
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            );
          } else {
            return (
              <Col md={4} className="mb-4" key={video.video_id}>
                <Card className="h-100">
                  {video.thumbnail_url ? (
                    <Card.Img
                      src={video.thumbnail_url}
                      alt={video.title}
                      style={{ height: "180px", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="bg-secondary d-flex align-items-center justify-content-center"
                      style={{ height: "180px", color: "#fff" }}
                    >
                      No Image Available
                    </div>
                  )}

                  <Card.Body className="d-flex flex-column">
                    <Card.Title>{video.title}</Card.Title>
                    <Card.Text>
                      Published at:{" "}
                      {new Date(video.published_at).toLocaleDateString()}
                    </Card.Text>

                    <Button
                      as={Link as any}
                      to={`/VideoDetails/${video.video_id}`}
                      variant="primary"
                      className="mt-auto"
                    >
                      View Video Details
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            );
          }
        })}
      </Row>

      {/* Sentinel Element for Intersection Observer */}
      <div ref={ref}></div>

      {/* Loading More Indicator */}
      {loading && videos.length > 0 && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" role="status">
            <span className="visually-hidden">Loading more videos...</span>
          </Spinner>
        </div>
      )}

      {/* No More Videos */}
      {!hasMore && videos.length > 0 && (
        <Alert variant="info" className="my-4 text-center">
          You've reached the end of the list.
        </Alert>
      )}
    </Container>
  );
};

export default ChannelVideos;
