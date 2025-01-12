// src/pages/PlayListsVideos.tsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Input from "../components/Input";
import usePlayListVideos from "../hooks/usePlayListVideos";

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
    <div className="container my-4">
      <h1 className="mb-4">PlayLists Videos</h1>
      <Input
        onSubmitChannelId={handlePlaylistIdSubmit}
        placeholder="Enter Playlist ID"
      />

      {/* Loading State */}
      {loading && (
        <div className="text-center my-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="alert alert-danger my-4" role="alert">
          Error: {error}
        </div>
      )}

      {/* Videos Display */}
      {videos && videos.length > 0 && (
        <div className="row">
          {videos.map((video) => (
            <div className="col-md-6 mb-4" key={video.video_id}>
              <div className="card h-100">
                {/* Video Thumbnail */}
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    className="card-img-top"
                    alt={video.title}
                    style={{ height: "200px", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="card-img-top bg-secondary d-flex align-items-center justify-content-center"
                    style={{ height: "200px", color: "#fff" }}
                  >
                    No Image Available
                  </div>
                )}

                <div className="card-body d-flex flex-column">
                  {/* Video Title */}
                  <h5 className="card-title">{video.title}</h5>

                  {/* Video Description */}
                  <p className="card-text">Video Id: {video.video_id}</p>

                  {/* Published Date */}
                  <p className="mt-auto">
                    <small className="text-muted">
                      Published at:{" "}
                      {new Date(video.published_at).toLocaleDateString()}
                    </small>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Videos Found */}
      {!loading && !error && currentPlaylistId && videos.length === 0 && (
        <div className="alert alert-info my-4" role="alert">
          No videos found for this playlist.
        </div>
      )}
    </div>
  );
};

export default PlayListsVideos;
