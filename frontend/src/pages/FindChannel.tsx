// src/pages/FindChannel.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import Input from "../components/Input";
import useSearchChannels from "../hooks/useSearchChannels";
import {
  Button,
  Card,
  Spinner,
  Alert,
  Container,
  Row,
  Col,
} from "react-bootstrap";

const FindChannel = () => {
  const [channelHandle, setChannelHandle] = useState<string | null>(null);
  const { channels, loading, error } = useSearchChannels(channelHandle);
  const navigate = useNavigate(); // Initialize useNavigate

  const handleChannelLinkSubmit = (submittedLink: string) => {
    const extractedHandle = extractHandle(submittedLink);
    if (extractedHandle) {
      setChannelHandle(extractedHandle);
    } else {
      alert("Invalid YouTube Channel URL. Please enter a valid link.");
    }
  };

  // Function to extract handle from YouTube channel URL
  const extractHandle = (url: string): string | null => {
    const regex = /youtube\.com\/@([A-Za-z0-9_]+)/;
    const match = url.match(regex);
    return match ? `@${match[1]}` : null;
  };

  const handleViewPlaylists = async (channel_id: string) => {
    try {
      // Fetch playlists for the channel to check if any exist
      const response = await fetch(
        `http://localhost:5000/youtube/get_channel_playlists/${channel_id}?max_results=1`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch playlists.");
      }
      const data = await response.json();
      console.log(data);

      if (data.length > 0) {
        // If playlists exist, navigate to the playlists page
        navigate(`/ChannelPlayLists/${channel_id}`);
      } else {
        // If no playlists, navigate directly to videos page
        navigate(`/ChannelVideos/${channel_id}`);
      }
    } catch (err: any) {
      console.error(err);
      alert("An error occurred while fetching playlists.");
    }
  };

  return (
    <Container className="my-4">
      <h1 className="mb-4">Find YouTube Channels</h1>
      <Input
        onSubmitChannelId={handleChannelLinkSubmit}
        placeholder="Enter YouTube Channel URL (e.g., https://www.youtube.com/@johnnyharris)"
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

      {/* Channels Display */}
      {channels && channels.length > 0 && (
        <Row>
          {channels.map((channel) => (
            <Col md={4} className="mb-4" key={channel.channel_id}>
              <Card className="h-100">
                {/* Channel Thumbnail */}
                {channel.thumbnail_url ? (
                  <Card.Img
                    src={channel.thumbnail_url}
                    alt={channel.title}
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
                  {/* Channel Title */}
                  <Card.Title>{channel.title}</Card.Title>
                  {/* Channel Description */}
                  <Card.Text>
                    {channel.description
                      ? channel.description.substring(0, 100) + "..."
                      : "No description available."}
                  </Card.Text>
                  <Card.Text>{channel.channel_id}</Card.Text>
                  {/* View Playlists Button */}
                  <Button
                    variant="primary"
                    className="mt-auto"
                    onClick={() => handleViewPlaylists(channel.channel_id)}
                  >
                    View Playlists
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* No Channels Found */}
      {!loading && !error && channelHandle && channels.length === 0 && (
        <Alert variant="info" className="my-4">
          No channels found matching the provided handle.
        </Alert>
      )}
    </Container>
  );
};

export default FindChannel;
