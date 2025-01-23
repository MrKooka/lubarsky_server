// frontend/src/components/AddTranscriptButton.tsx
import React from "react";
import { useAddTranscript } from "../hooks/useAddTranscript";

interface AddTranscriptButtonProps {
  videoId_: string;
  onAdded?: () => void;
}

const AddTranscriptButton: React.FC<AddTranscriptButtonProps> = ({
  videoId_,
  onAdded,
}) => {
  const { addTranscript, loading, error, success } = useAddTranscript();

  const handleAdd = async () => {
    await addTranscript(videoId_);
    if (onAdded && !error) {
      onAdded();
    }
  };

  return (
    <div>
      <button onClick={handleAdd} disabled={loading}>
        {loading ? "Adding..." : "Add"}
      </button>
      {error && <div style={{ color: "red" }}>Error: {error}</div>}
      {success && <div style={{ color: "green" }}>Added successfully!</div>}
    </div>
  );
};

export default AddTranscriptButton;
