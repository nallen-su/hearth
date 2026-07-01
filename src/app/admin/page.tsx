import { getConfig } from "@/lib/config";
import { pingDatabase } from "@/lib/db";
import { pingLiveKit } from "@/lib/livekit";

export const dynamic = "force-dynamic";

/**
 * Minimal operator status page (FR-24). Read-only: shows the effective configuration
 * (secrets redacted) and live dependency health so an operator can verify a deployment.
 * Gated by ADMIN_KEY via ?key=; disabled entirely when ADMIN_KEY is unset. Config itself
 * is env-driven (12-factor) — this surface is for verification, not editing.
 *
 * Note: the key travels in the query string, so operators should still restrict /admin at
 * the network layer for anything sensitive.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const config = getConfig();

  if (!config.admin.key) {
    return (
      <main className="centered">
        <h1 style={{ margin: 0 }}>Admin disabled</h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          Set <code>ADMIN_KEY</code> to enable the status page.
        </p>
      </main>
    );
  }

  if (searchParams.key !== config.admin.key) {
    return (
      <main className="centered">
        <h1 style={{ margin: 0 }}>Not authorized</h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          Append <code>?key=…</code> with the configured admin key.
        </p>
      </main>
    );
  }

  const [db, livekit] = await Promise.allSettled([pingDatabase(), pingLiveKit()]);
  const health: [string, boolean][] = [
    ["database", db.status === "fulfilled" && db.value === true],
    ["livekit", livekit.status === "fulfilled" && livekit.value === true],
  ];

  const settings: [string, string][] = [
    ["App URL", config.appUrl],
    ["Environment", config.isProd ? "production" : "development"],
    ["LiveKit URL (client)", process.env.NEXT_PUBLIC_LIVEKIT_URL ?? config.livekit.url],
    ["LiveKit API URL", config.livekit.httpUrl],
    ["LiveKit API secret", "••••••••"],
    ["Max participants / room", String(config.meeting.maxParticipants)],
    ["Waiting room default", config.meeting.waitingRoomDefault ? "on" : "off"],
    [
      "Invite link expiry",
      config.meeting.linkExpiryHours > 0 ? `${config.meeting.linkExpiryHours}h` : "never",
    ],
    ["Chat persistence", "off (deferred)"],
  ];

  return (
    <main style={{ maxWidth: "640px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ marginTop: 0 }}>Hearth — operator status</h1>

      <h2 style={{ fontSize: "1rem" }}>Health</h2>
      <ul className="admin-list">
        {health.map(([name, ok]) => (
          <li key={name}>
            <span>{name}</span>
            <span style={{ color: ok ? "#4ade80" : "#f87171" }}>{ok ? "ok" : "error"}</span>
          </li>
        ))}
      </ul>

      <h2 style={{ fontSize: "1rem" }}>Configuration</h2>
      <ul className="admin-list">
        {settings.map(([name, value]) => (
          <li key={name}>
            <span>{name}</span>
            <span style={{ color: "var(--color-text-muted)", fontFamily: "monospace" }}>
              {value}
            </span>
          </li>
        ))}
      </ul>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
        Configuration is env-driven — change values in the environment and restart. coturn
        has no HTTP surface here; check it via <code>docker compose ps</code>.
      </p>
    </main>
  );
}
