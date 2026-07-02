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

type Created = { token: string; hostKey: string; roomName: string };

/** A read-only field with a copy button. */
function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="copy-row">
      <div className="copy-row-head">
        <span>{label}</span>
        <button className="link-btn" onClick={copy}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <code className="copy-row-value">{value}</code>
      {hint && <small style={{ color: "var(--color-text-muted)" }}>{hint}</small>}
    </div>
  );
}

export default function JoinForm({ waitingDefault = false }: { waitingDefault?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [waitingEnabled, setWaitingEnabled] = useState(waitingDefault);
  const [linkInput, setLinkInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const rememberHost = (token: string, hostKey: string) => {
    try {
      localStorage.setItem(`hearth-host:${token}`, hostKey);
    } catch {
      /* storage may be unavailable (private mode) */
    }
  };

  // join=true drops you straight into the meeting; join=false returns links to share/schedule.
  const createMeeting = async (join: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, waitingEnabled }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn’t create the meeting.");
      rememberHost(body.token, body.hostKey);
      if (join) {
        router.push(`/room/${body.token}`);
      } else {
        setCreated(body);
        setBusy(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const joinByLink = () => {
    const token = parseInviteToken(linkInput);
    if (token) router.push(`/room/${encodeURIComponent(token)}`);
  };

  if (created) {
    const origin = window.location.origin;
    const guestLink = `${origin}/room/${created.token}`;
    const hostLink = `${guestLink}?host=${created.hostKey}`;
    return (
      <div className="join-panel">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Meeting ready</h2>
        <CopyRow label="Invite link (share this)" value={guestLink} />
        <CopyRow
          label="Host link (keep private)"
          value={hostLink}
          hint="Opening this makes you the host — don’t share it."
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn" onClick={() => router.push(`/room/${created.token}`)}>
            Join now
          </button>
          <button className="btn btn-secondary" onClick={() => setCreated(null)}>
            New meeting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-panel">
      <input
        className="input"
        placeholder="Meeting name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && createMeeting(true)}
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
      <button className="btn" onClick={() => createMeeting(true)} disabled={busy}>
        {busy ? "Working…" : "Start meeting"}
      </button>
      <button className="btn btn-secondary" onClick={() => createMeeting(false)} disabled={busy}>
        Create link for later
      </button>

      {error && <p style={{ color: "#f87171", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

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
