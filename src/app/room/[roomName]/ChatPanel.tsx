"use client";

import { Chat, formatChatMessageLinks } from "@livekit/components-react";

/**
 * Side chat panel (FR-14/15). Wraps LiveKit's `Chat` prefab, which sends/receives over
 * the data channel and renders sender + timestamp per message; `formatChatMessageLinks`
 * turns URLs into links.
 *
 * Chat is ephemeral in v1 (FR-16) — messages live only for the meeting. Optional
 * persistence to Postgres is deferred to M5, where rooms get a DB identity to attach
 * messages to.
 */
export default function ChatPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="chat-panel" data-lk-theme="default">
      <div className="chat-panel-head">
        <span>Chat</span>
        <button className="link-btn" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </div>
      <Chat className="chat-body" messageFormatter={formatChatMessageLinks} />
    </aside>
  );
}
