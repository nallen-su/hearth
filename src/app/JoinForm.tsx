"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Short, URL-friendly room id for "New meeting". */
function randomRoomId(): string {
  return `room-${Math.random().toString(36).slice(2, 8)}`;
}

export default function JoinForm() {
  const router = useRouter();
  const [room, setRoom] = useState("");

  const join = (name: string) => {
    const target = name.trim();
    if (!target) return;
    router.push(`/room/${encodeURIComponent(target)}`);
  };

  return (
    <div style={{ width: "min(100%, 380px)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <button className="btn" onClick={() => join(randomRoomId())}>
        New meeting
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid var(--color-border)" }} />
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>or join one</span>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid var(--color-border)" }} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          join(room);
        }}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input
          className="input"
          placeholder="Room name"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          aria-label="Room name"
        />
        <button className="btn btn-secondary" type="submit" disabled={!room.trim()}>
          Join
        </button>
      </form>
    </div>
  );
}
