function VideoPlayer({
  videoRef,
  videoUrl,
  videoTitle,
  onLoadedMetadata,
  onTimeUpdate,
}) {
  return (
    <div className="card mt-4">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">{videoTitle || "Video Editor"}</h5>
      </div>
      <div className="card-body p-0">
        <video
          ref={videoRef}
          className="w-100"
          controls
          src={videoUrl}
          style={{ maxHeight: "70vh" }}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}

export default VideoPlayer;
