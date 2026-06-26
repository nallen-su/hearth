import { NextRequest, NextResponse } from "next/server";
import { countParticipants, createParticipantToken } from "@/lib/livekit";
import { resolveInvite, verifyHost } from "@/lib/rooms";

// livekit-server-sdk + pg need the Node runtime; never run on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/token?invite=<inviteToken>&username=<displayName>
 *
 * Validates the invite link (exists, not revoked, not expired), enforces the room's
 * participant cap, then mints a short-lived LiveKit token scoped to the room's slug.
 */
export async function GET(req: NextRequest) {
  const invite = req.nextUrl.searchParams.get("invite")?.trim();
  const username = req.nextUrl.searchParams.get("username")?.trim();
  const hostKey = req.nextUrl.searchParams.get("hostKey")?.trim();

  if (!invite || !username) {
    return NextResponse.json(
      { error: "Both 'invite' and 'username' are required." },
      { status: 400 },
    );
  }

  const resolution = await resolveInvite(invite);
  if (!resolution.ok) {
    const status = resolution.reason === "not_found" ? 404 : 410;
    return NextResponse.json({ error: `Invite link ${resolution.reason}.` }, { status });
  }

  const { room } = resolution;
  const isHost = hostKey ? (await verifyHost(invite, hostKey)) !== null : false;

  // Locked meetings reject new joins — except the host (FR-22).
  if (room.locked && !isHost) {
    return NextResponse.json(
      { error: "This meeting is locked.", code: "room_locked" },
      { status: 403 },
    );
  }

  // Server-authoritative cap (FR-5). The host is exempt so they can always get back in.
  if (!isHost) {
    const current = await countParticipants(room.slug);
    if (current >= room.maxParticipants) {
      return NextResponse.json(
        { error: "This meeting is full.", code: "room_full" },
        { status: 403 },
      );
    }
  }

  // Non-hosts enter the waiting room when it's enabled (FR-20).
  const waiting = !isHost && room.waitingEnabled;
  const role = isHost ? "host" : waiting ? "waiting" : "guest";

  try {
    const token = await createParticipantToken(room.slug, username, role);
    // Initial flags so the UI is correct before any host action writes room metadata.
    return NextResponse.json({
      token,
      roomName: room.name ?? room.slug,
      isHost,
      waiting,
      locked: room.locked,
      waitingEnabled: room.waitingEnabled,
    });
  } catch (err) {
    console.error("[token] failed to mint access token:", err);
    return NextResponse.json({ error: "Failed to create access token." }, { status: 500 });
  }
}
