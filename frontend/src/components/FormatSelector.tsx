// components/FormatSelector.js
import React from "react";

function FormatSelector({
  formats,
  selectedFormat,
  onChange,
  videoTitle,
  onDownload,
}) {
  if (formats.length === 0) return null;

  return (
    <div className="card mt-4">
      <div className="card-header">
        <h5 className="mb-0">Available formats for: {videoTitle}</h5>
      </div>
      <div className="card-body">
        <select
          className="form-select mb-3"
          onChange={onChange}
          value={selectedFormat}
        >
          <option value="">-- Select format --</option>
          {formats.map((f) => (
            <option key={f.format_id} value={f.format_id}>
              {f.resolution} ({f.filesize_mb} aprox)
            </option>
          ))}
        </select>

        <button
          className="btn btn-success"
          onClick={onDownload}
          disabled={!selectedFormat}
        >
          Download selected format
        </button>
      </div>
    </div>
  );
}

export default FormatSelector;
