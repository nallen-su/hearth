"use client";

import { useCallback, useRef, useState } from "react";
import { useDataChannel } from "@livekit/components-react";
import { useDismiss } from "./useDismiss";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👏", "😮"];
const REACTIONS_TOPIC = "reactions";

export type FloatingReaction = { id: string; emoji: string; left: number };

/**
 * Transient emoji reactions over the LiveKit data channel (FR-17). Reactions are fire-
 * and-forget — nothing is stored. The sender doesn't receive its own data message back,
 * so we echo locally.
 */
export function useReactions() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const spawn = useCallback((emoji: string) => {
    const id = crypto.randomUUID();
    const left = 8 + Math.random() * 84; // random horizontal start (%)
    setReactions((cur) => [...cur, { id, emoji, left }]);
    setTimeout(() => setReactions((cur) => cur.filter((r) => r.id !== id)), 4000);
  }, []);

  const { send } = useDataChannel(REACTIONS_TOPIC, (msg) => {
    try {
      spawn(new TextDecoder().decode(msg.payload));
    } catch {
      /* ignore malformed payloads */
    }
  });

  const sendReaction = useCallback(
    (emoji: string) => {
      void send(new TextEncoder().encode(emoji), { reliable: true });
      spawn(emoji); // local echo
    },
    [send, spawn],
  );

  return { reactions, sendReaction };
}

/** Emoji picker button (sits in the control bar). */
export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  return (
    <div className="reaction-bar" ref={ref}>
      <button
        className="ctrl-btn"
        aria-label="Send a reaction"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        😊
      </button>
      {open && (
        <div className="reaction-popover" role="menu">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Floating emojis rising over the stage. Non-interactive. */
export function ReactionsOverlay({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="reactions-overlay" aria-hidden>
      {reactions.map((r) => (
        <span key={r.id} className="floating-reaction" style={{ left: `${r.left}%` }}>
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
