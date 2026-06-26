import Link from "next/link";
import RoomClient from "./RoomClient";
import { resolveInvite } from "@/lib/rooms";

export const dynamic = "force-dynamic";

/**
 * Join route. The dynamic segment is an invite token (the shareable credential).
 * Resolve it server-side; if it's invalid/expired/revoked, show a message instead of
 * the lobby. Valid links render the pre-join → meeting client.
 */
export default async function RoomPage({ params }: { params: { token: string } }) {
  const resolution = await resolveInvite(params.token);

  if (!resolution.ok) {
    const message =
      resolution.reason === "expired"
        ? "This invite link has expired."
        : resolution.reason === "revoked"
          ? "This invite link has been revoked."
          : "This invite link is invalid.";
    return (
      <main className="centered">
        <h1 style={{ margin: 0 }}>Can’t join</h1>
        <p style={{ color: "var(--color-text-muted)" }}>{message}</p>
        <Link className="btn" href="/">
          Back to start
        </Link>
      </main>
    );
  }

  return (
    <RoomClient
      inviteToken={params.token}
      roomName={resolution.room.name ?? resolution.room.slug}
    />
  );
}
