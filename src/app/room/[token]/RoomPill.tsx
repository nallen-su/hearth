"use client";

import { useRef, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { useDismiss } from "./useDismiss";

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

/** Read a participant's role from its metadata ({"role": ...}). */
function roleOf(metadata: string | undefined): string {
  try {
    return JSON.parse(metadata || "{}").role ?? "guest";
  } catch {
    return "guest";
  }
}

interface HostControls {
  isHost: boolean;
  raisedIdentities: Set<string>;
  sharingIdentity: string | null;
  onMute: (identity: string) => void;
  onLowerHand: (identity: string) => void;
  onStopShare: (identity: string) => void;
  onRemove: (identity: string) => void;
  onMuteAll: () => void;
  onPromote: (identity: string) => void;
  onDemote: (identity: string) => void;
}

/**
 * Compact room pill: participant count (click for the attendee list) · room name ·
 * copy-link button. When the local user is the host, the attendee list also exposes
 * per-participant controls (mute, lower hand, stop share, remove) and "mute all".
 */
export default function RoomPill({
  roomName,
  isHost,
  raisedIdentities,
  sharingIdentity,
  onMute,
  onLowerHand,
  onStopShare,
  onRemove,
  onMuteAll,
  onPromote,
  onDemote,
}: { roomName: string } & HostControls) {
  const participants = useParticipants();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss(open, containerRef, () => setOpen(false));

  // Waiting participants are shown to the host in a separate panel, not the main roster.
  const active = participants.filter((p) => roleOf(p.metadata) !== "waiting");
  const sorted = [...active].sort((a, b) => {
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
          aria-haspopup="menu"
          aria-label="Show participants"
        >
          <PeopleIcon />
          {active.length}
        </button>

        {open && (
          <div className="attendee-list">
            <div className="attendee-list-head">Participants ({active.length})</div>
            <ul>
              {sorted.map((p) => {
                const host = roleOf(p.metadata) === "host";
                const showActions = isHost && !p.isLocal;
                return (
                  <li key={p.sid}>
                    <span className="attendee-name">{p.name || p.identity}</span>
                    {host && <span className="attendee-tag">host</span>}
                    {p.isLocal && <span className="attendee-you">you</span>}
                    {showActions && (
                      <span className="attendee-actions">
                        {raisedIdentities.has(p.identity) && (
                          <button title="Lower hand" onClick={() => onLowerHand(p.identity)}>
                            ✋
                          </button>
                        )}
                        {sharingIdentity === p.identity && (
                          <button title="Stop screen share" onClick={() => onStopShare(p.identity)}>
                            ⊘
                          </button>
                        )}
                        {host ? (
                          <button title="Remove co-host" onClick={() => onDemote(p.identity)}>
                            ★
                          </button>
                        ) : (
                          <button title="Make co-host" onClick={() => onPromote(p.identity)}>
                            ☆
                          </button>
                        )}
                        <button title="Mute" onClick={() => onMute(p.identity)}>
                          🔇
                        </button>
                        <button
                          className="danger"
                          title="Remove from meeting"
                          onClick={() => onRemove(p.identity)}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {isHost && (
              <div className="attendee-list-foot">
                <button className="link-btn" onClick={onMuteAll}>
                  Mute everyone
                </button>
              </div>
            )}
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
