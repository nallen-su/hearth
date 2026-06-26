"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Pull the invite token out of a pasted full URL, or accept a bare token. */
function parseInviteToken(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last || null;
  } catch {
    // Not a URL — treat as a bare token (strip any leading /room/).
    return value.replace(/^\/?room\//, "").replace(/^\/+/, "") || null;
  }
}

export default function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [waitingEnabled, setWaitingEnabled] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMeeting = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, waitingEnabled }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn’t create the meeting.");
      // Remember the host key locally — it makes this browser the meeting host.
      try {
        localStorage.setItem(`hearth-host:${body.token}`, body.hostKey);
      } catch {
        /* storage may be unavailable (private mode) — host controls just won't show */
      }
      router.push(`/room/${body.token}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  };

  const joinByLink = () => {
    const token = parseInviteToken(linkInput);
    if (token) router.push(`/room/${encodeURIComponent(token)}`);
  };

  return (
    <div
      style={{ width: "min(100%, 380px)", display: "flex", flexDirection: "column", gap: "0.75rem" }}
    >
      <input
        className="input"
        placeholder="Meeting name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && createMeeting()}
        aria-label="Meeting name"
        maxLength={80}
      />
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={waitingEnabled}
          onChange={(e) => setWaitingEnabled(e.target.checked)}
        />
        <span>
          Admit guests manually
          <small>Guests wait until you let them in (waiting room)</small>
        </span>
      </label>
      <button className="btn" onClick={createMeeting} disabled={creating}>
        {creating ? "Starting…" : "Start meeting"}
      </button>

      {error && (
        <p style={{ color: "#f87171", fontSize: "0.85rem", margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid var(--color-border)" }} />
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>or join with a link</span>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid var(--color-border)" }} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          joinByLink();
        }}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input
          className="input"
          placeholder="Paste invite link"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          aria-label="Invite link"
        />
        <button className="btn btn-secondary" type="submit" disabled={!parseInviteToken(linkInput)}>
          Join
        </button>
      </form>
    </div>
  );
}
