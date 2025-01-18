// src/pages/VideoDetails.tsx
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Input from "../components/Input";
import useFetchVideoDetails from "../hooks/useFetchVideoDetails";
import {
  Button,
  Card,
  Spinner,
  Alert,
  Container,
  Row,
  Col,
} from "react-bootstrap";

const VideoDetails: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(
    videoId || null
  );
  const { videoDetails, loading, error } = useFetchVideoDetails(currentVideoId);
  const [transcriptLoading, setTranscriptLoading] = useState<boolean>(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);

  // Update currentVideoId when URL param changes
  useEffect(() => {
    if (videoId) {
      setCurrentVideoId(videoId);
    }
  }, [videoId]);

  // Handle form submission
  const handleVideoLinkSubmit = (link: string) => {
    const extractedVideoId = extractVideoId(link);
    if (extractedVideoId) {
      setCurrentVideoId(extractedVideoId);
    } else {
      alert("Invalid YouTube URL. Please enter a valid link.");
    }
  };

  // Function to extract video ID from YouTube URL
  const extractVideoId = (url: string): string | null => {
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/;
    const match = url.match(regex);
    console.log(match);

    return match ? match[1] : null;
  };

  // Handle Transcript Button Click
  const handleTranscript = async () => {
    if (!currentVideoId) return;
    setTranscriptLoading(true);
    setTranscriptError(null);
    setTranscript(null);
    try {
      const response = await fetch(
        `/api/youtube/transcribe_video/${currentVideoId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoId: currentVideoId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      setTranscript(data.transcript); // Assuming the backend returns { transcript: "..." }
    } catch (err: any) {
      setTranscriptError(err.message);
    } finally {
      setTranscriptLoading(false);
    }
  };

  return (
    <Container className="my-4">
      <h1 className="mb-4">Video Details</h1>

      {/* Input for YouTube Video Link */}
      <Input
        onSubmitChannelId={handleVideoLinkSubmit}
        placeholder="Enter YouTube Video URL"
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
          {error}
        </Alert>
      )}

      {/* Video Details Display */}
      {videoDetails && (
        <Card className="my-4">
          <Row className="g-0">
            <Col md={4}>
              {videoDetails.thumbnail_url ? (
                <Card.Img
                  src={videoDetails.thumbnail_url}
                  alt={videoDetails.title}
                  style={{ height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  className="bg-secondary d-flex align-items-center justify-content-center"
                  style={{ height: "100%", color: "#fff" }}
                >
                  No Image Available
                </div>
              )}
            </Col>
            <Col md={8}>
              <Card.Body>
                <Card.Title>{videoDetails.title}</Card.Title>
                <Card.Text>{videoDetails.description}</Card.Text>
                <Card.Text>
                  <strong>Published At:</strong>{" "}
                  {new Date(videoDetails.published_at).toLocaleDateString()}
                </Card.Text>
                <Card.Text>
                  <strong>Channel:</strong> {videoDetails.channel_title} (
                  <Link to={`/ChannelVideos/${videoDetails.channel_id}`}>
                    {videoDetails.channel_id}
                  </Link>
                  )
                </Card.Text>
                <Button
                  variant="primary"
                  onClick={handleTranscript}
                  disabled={transcriptLoading}
                >
                  {transcriptLoading ? "Transcribing..." : "Transcript"}
                </Button>
              </Card.Body>
            </Col>
          </Row>
        </Card>
      )}

      {/* Transcript Loading State */}
      {transcriptLoading && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" role="status">
            <span className="visually-hidden">Transcribing...</span>
          </Spinner>
        </div>
      )}

      {/* Transcript Error State */}
      {transcriptError && (
        <Alert variant="danger" className="my-4">
          {transcriptError}
        </Alert>
      )}

      {/* Display Transcript */}
      {transcript && (
        <Card className="my-4">
          <Card.Header>Transcript</Card.Header>
          <Card.Body>
            <Card.Text style={{ whiteSpace: "pre-wrap" }}>
              {transcript}
            </Card.Text>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default VideoDetails;
