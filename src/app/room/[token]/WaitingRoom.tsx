"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useLocalParticipant,
  useRoomContext,
  type LocalUserChoices,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useDismiss } from "./useDismiss";

/**
 * Gates the meeting behind the waiting room (FR-20). A waiting participant is connected
 * but has no publish/subscribe permission; this shows a holding screen until the host
 * admits them (which the server signals via a permission change), then enables their
 * chosen camera/mic and reveals the meeting.
 *
 * When `waiting` is false (host, or waiting room off) it renders children immediately —
 * the camera/mic were already enabled at connect.
 */
export default function WaitingRoom({
  waiting,
  choices,
  roomName,
  children,
}: {
  waiting: boolean;
  choices: LocalUserChoices;
  roomName: string;
  children: ReactNode;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [admitted, setAdmitted] = useState(!waiting);

  useEffect(() => {
    if (!waiting) return;
    const check = () => {
      if (localParticipant.permissions?.canPublish) setAdmitted(true);
    };
    check(); // in case we were admitted before this mounted
    room.on(RoomEvent.ParticipantPermissionsChanged, check);
    return () => {
      room.off(RoomEvent.ParticipantPermissionsChanged, check);
    };
  }, [waiting, room, localParticipant]);

  useEffect(() => {
    if (admitted && waiting) {
      void localParticipant.setCameraEnabled(choices.videoEnabled).catch(() => undefined);
      void localParticipant.setMicrophoneEnabled(choices.audioEnabled).catch(() => undefined);
    }
    // Only run on the waiting -> admitted transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admitted]);

  if (!admitted) {
    return (
      <div className="centered" data-lk-theme="default">
        <div className="waiting-pulse" aria-hidden />
        <h2 style={{ margin: 0 }}>Waiting to be let in</h2>
        <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
          The host will admit you to “{roomName}” shortly.
        </p>
        <button className="btn btn-secondary" onClick={() => room.disconnect()}>
          Leave
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

/** Host-only topbar indicator: who's waiting, with admit/deny + admit-all. */
export function WaitingHostIndicator({
  waiting,
  onAdmit,
  onDeny,
  onAdmitAll,
}: {
  waiting: { identity: string; name: string }[];
  onAdmit: (identity: string) => void;
  onDeny: (identity: string) => void;
  onAdmitAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  if (waiting.length === 0) return null;

  return (
    <div className="hands-indicator" ref={ref}>
      <button
        className="hands-pill"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ⧗ {waiting.length} waiting
      </button>
      {open && (
        <div className="attendee-list">
          <div className="attendee-list-head">Waiting ({waiting.length})</div>
          <ul>
            {waiting.map((w) => (
              <li key={w.identity}>
                <span className="attendee-name">{w.name}</span>
                <span className="attendee-actions">
                  <button title="Admit" onClick={() => onAdmit(w.identity)}>
                    ✓
                  </button>
                  <button className="danger" title="Deny" onClick={() => onDeny(w.identity)}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="attendee-list-foot">
            <button className="link-btn" onClick={onAdmitAll}>
              Admit all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
