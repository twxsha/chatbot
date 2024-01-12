import React, { useState, useEffect } from "react";
import Icon from '../assets/mercor_icon.png';

export default function BotMessage({ fetchMessage }) {
  const [isLoading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    async function loadMessage() {
      const { message, candidates } = await fetchMessage();
      setLoading(false);
      console.log(message, candidates);

      setMessage(message);
      setCandidates(candidates || []); // Ensure candidates is an array

    }
    loadMessage();
  }, [fetchMessage]);

  return (
    <>
      {candidates.length > 0 && (
        <div className="message-container-bot">
          <img className="chat-logo" src={Icon} alt="Mercor Icon" />
          <div className="bot-message">{isLoading ? "..." : "Here are some candidates that match your requests:"}</div>
        </div>
      )}
      {candidates.map((candidate, index) => (
        <div key={index} className="candidate-container-bot">
          <div className="candidate"> 
              <div className="candidate_name"> {candidate.name} </div>
              <div className="candidate_education"> {candidate.schools} </div>
              <div className="candidate_education"> {candidate.companies} </div>
              <div className="candidate_education"> {candidate.skills} </div>
              <a href={"malito:"+candidate.email}><button className="candidate_email">Email</button></a>
              <a href={candidate.phone}><button className="candidate_email">Phone</button></a>
          </div>
        </div>
      ))}
      <div className="message-container-bot">
        <img className="chat-logo" src={Icon} alt="Mercor Icon" />
        <div className="bot-message">{isLoading ? "..." : message}</div>
      </div>
    </>
  );
}
