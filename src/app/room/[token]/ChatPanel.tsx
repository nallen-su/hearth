"use client";

import { Chat, formatChatMessageLinks } from "@livekit/components-react";

/**
 * Side chat panel (FR-14/15). Wraps LiveKit's `Chat` prefab, which sends/receives over
 * the data channel and renders sender + timestamp per message; `formatChatMessageLinks`
 * turns URLs into links.
 *
 * The panel stays mounted and is hidden with CSS (not conditionally rendered) so the
 * underlying useChat keeps accumulating messages while closed — otherwise reopening it
 * would show an empty history for anything received while it was shut.
 *
 * Chat is ephemeral in v1 (FR-16); persistence to Postgres is deferred to M5.
 */
export default function ChatPanel({
  hidden,
  onClose,
}: {
  hidden: boolean;
  onClose: () => void;
}) {
  return (
    <aside className={`chat-panel${hidden ? " is-hidden" : ""}`} data-lk-theme="default">
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
