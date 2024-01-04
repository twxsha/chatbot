import React from "react";

export default function UserMessage({ text }) {
  return (
    <div className="message-container-user">
      <div className="user-message">{text}</div>
    </div>
  );
}
