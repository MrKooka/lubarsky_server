// src/pages/ChannelPlayLists.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom"; // Import Link from react-router-dom
import Input from "../components/Input";
import useChannelPlayLists from "../hooks/useChannelPlayLists";

const ChannelPlayLists = () => {
  const [channelId, setChannelId] = useState<string | null>(null);
  const { playLists, loading, error } = useChannelPlayLists(channelId, 10);

  const handleChannelIdSubmit = (submittedChannelId: string) => {
    console.log("User entered channel ID:", submittedChannelId);
    setChannelId(submittedChannelId);
  };

  return (
    <div className="container my-4">
      <h1 className="mb-4">Channel PlayLists</h1>
      <Input
        onSubmitChannelId={handleChannelIdSubmit}
        placeholder="Enter Channel ID"
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

      {/* PlayLists Display */}
      {playLists && playLists.length > 0 && (
        <div className="row">
          {playLists.map((playlist) => (
            <div className="col-md-4 mb-4" key={playlist.id}>
              <div className="card h-100">
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
                  {/*Channel Id  */}
                  <p className="card-text">Playlist Id: {playlist.id}</p>
                  {/* Playlist Description */}
                  <p className="card-text">{playlist.description}</p>

                  {/* Playlist ID as Link */}
                  <p className="mt-auto">
                    <Link
                      to={`/PlayListsVideos/${playlist.id}`}
                      className="btn btn-primary"
                    >
                      View Playlist
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No PlayLists Found */}
      {!loading && !error && channelId && playLists.length === 0 && (
        <div className="alert alert-info my-4" role="alert">
          No playlists found for this channel.
        </div>
      )}
    </div>
  );
};

export default ChannelPlayLists;
