"use client";

import { useEffect, useRef, useState } from "react";
import { useParticipants } from "@livekit/components-react";

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
 * Compact room pill: participant count (click for the attendee list) · room name ·
 * copy-link button (copies the current meeting URL).
 */
export default function RoomPill({ roomName }: { roomName: string }) {
  const participants = useParticipants();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the attendee dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const sorted = [...participants].sort((a, b) => {
    if (a.isLocal) return -1;
    if (b.isLocal) return 1;
    return (a.name || a.identity).localeCompare(b.name || b.identity);
  });

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
    <div className="room-pill" ref={containerRef}>
      <div className="room-pill-people">
        <button
          className="room-pill-count"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Show participants"
        >
          <PeopleIcon />
          {participants.length}
        </button>

        {open && (
          <div className="attendee-list">
            <div className="attendee-list-head">Participants ({participants.length})</div>
            <ul>
              {sorted.map((p) => (
                <li key={p.sid}>
                  <span className="attendee-name">{p.name || p.identity}</span>
                  {p.isLocal && <span className="attendee-you">you</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
