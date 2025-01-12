import React, { useState } from "react";

type InputProps = {
  onSubmitChannelId: (channelId: string) => void;
  placeholder?: string;
};

const Input = ({ onSubmitChannelId, placeholder = "Enter ID" }: InputProps) => {
  const [channelId, setChannelId] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChannelId(e.target.value);
  };

  const handleClick = () => {
    // This calls the parent's callback with the current channelId
    onSubmitChannelId(channelId);
  };

  return (
    <div className="input-group mb-3">
      <button
        className="btn btn-outline-secondary"
        type="button"
        id="button-addon1"
        onClick={handleClick}
      >
        Submit
      </button>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        aria-label="Example text with button addon"
        aria-describedby="button-addon1"
        value={channelId}
        onChange={handleChange}
      />
    </div>
  );
};

export default Input;
