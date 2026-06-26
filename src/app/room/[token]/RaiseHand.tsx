"use client";

import { useEffect, useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

const HAND_ATTR = "hand_raised"; // value = timestamp string when raised, "" when lowered

export type RaisedHand = { identity: string; name: string; at: number };

/**
 * Raise-hand state lives in participant attributes (FR-18) rather than a transient data
 * message, so late joiners immediately see who already has a hand up. The value is the
 * raise timestamp, which gives a stable, ordered queue.
 */
export function useRaisedHands(): RaisedHand[] {
  const room = useRoomContext();
  const [, force] = useState(0);

  useEffect(() => {
    const onChange = () => force((n) => n + 1);
    room
      .on(RoomEvent.ParticipantAttributesChanged, onChange)
      .on(RoomEvent.ParticipantConnected, onChange)
      .on(RoomEvent.ParticipantDisconnected, onChange);
    return () => {
      room
        .off(RoomEvent.ParticipantAttributesChanged, onChange)
        .off(RoomEvent.ParticipantConnected, onChange)
        .off(RoomEvent.ParticipantDisconnected, onChange);
    };
  }, [room]);

  const all = [room.localParticipant, ...room.remoteParticipants.values()];
  return all
    .map((p) => ({
      identity: p.identity,
      name: p.name || p.identity,
      at: Number(p.attributes?.[HAND_ATTR] || 0),
    }))
    .filter((h) => h.at > 0)
    .sort((a, b) => a.at - b.at);
}

/** Toggle button for the local participant's raised hand (sits in the control bar). */
export function RaiseHandButton({ raised }: { raised: RaisedHand[] }) {
  const { localParticipant } = useLocalParticipant();
  const isRaised = raised.some((h) => h.identity === localParticipant.identity);

  const toggle = () => {
    void localParticipant.setAttributes({
      ...localParticipant.attributes,
      [HAND_ATTR]: isRaised ? "" : String(Date.now()),
    });
  };

  return (
    <button
      className={`ctrl-btn${isRaised ? " active" : ""}`}
      aria-pressed={isRaised}
      onClick={toggle}
    >
      ✋ {isRaised ? "Lower" : "Raise"}
    </button>
  );
}

/** Topbar pill + ordered list of who has a hand up (visible to everyone). */
export function RaisedHandsIndicator({ raised }: { raised: RaisedHand[] }) {
  const [open, setOpen] = useState(false);
  if (raised.length === 0) return null;

  return (
    <div className="hands-indicator">
      <button className="hands-pill" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        ✋ {raised.length}
      </button>
      {open && (
        <ol className="hands-list">
          {raised.map((h, i) => (
            <li key={h.identity}>
              <span className="hands-rank">{i + 1}</span>
              {h.name}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
