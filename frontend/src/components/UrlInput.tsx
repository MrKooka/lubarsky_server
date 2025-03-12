// components/UrlInput.js
import React from "react";

function UrlInput({
  url,
  setUrl,
  onSubmit,
  isLoading,
  label = "Link to media",
  placeholder = "Input link URL",
  buttonText = "Process URL",
}) {
  return (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      <div className="input-group">
        <input
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={isLoading || !url}
        >
          {isLoading ? (
            <>
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
                aria-hidden="true"
              ></span>
              Processing...
            </>
          ) : (
            buttonText
          )}
        </button>
      </div>
    </div>
  );
}

export default UrlInput;
