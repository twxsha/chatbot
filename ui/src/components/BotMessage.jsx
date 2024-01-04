import React, { useState, useEffect } from "react";
import Icon from '../assets/mercor_icon.png';

export default function BotMessage({ fetchMessage }) {
  const [isLoading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadMessage() {
      const msg = await fetchMessage();
      setLoading(false);
      setMessage(msg);
    }
    loadMessage();
  }, [fetchMessage]);

  return (
    <div className="message-container-bot">
      <img className="chat-logo" src={Icon} alt="Mercor Icon" />
      <div className="bot-message">{isLoading ? "..." : message}</div>
    </div>
  );
}
