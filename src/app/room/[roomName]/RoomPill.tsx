"use client";

import { useState } from "react";

const PeopleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z" />
  </svg>
);

/**
 * Compact room pill: participant count · room name · copy-link button.
 * Copies the current meeting URL so it's one click to share an invite.
 */
export default function RoomPill({ roomName, count }: { roomName: string; count: number }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked (insecure context / permissions) — no-op */
    }
  };

  return (
    <div className="room-pill">
      <span className="room-pill-count" title={`${count} ${count === 1 ? "person" : "people"}`}>
        <PeopleIcon />
        {count}
      </span>
      <span className="room-pill-sep" />
      <span className="room-pill-name">{roomName}</span>
      <button
        className="room-pill-copy"
        onClick={copyLink}
        aria-label="Copy meeting link"
        title="Copy meeting link"
      >
        {copied ? "✓ Copied" : <CopyIcon />}
      </button>
    </div>
  );
}
