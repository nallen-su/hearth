import { NextRequest, NextResponse } from "next/server";
import { countParticipants, createParticipantToken } from "@/lib/livekit";
import { resolveInvite } from "@/lib/rooms";

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

  // Server-authoritative cap (FR-5).
  const current = await countParticipants(room.slug);
  if (current >= room.maxParticipants) {
    return NextResponse.json(
      { error: "This meeting is full.", code: "room_full" },
      { status: 403 },
    );
  }

  try {
    const token = await createParticipantToken(room.slug, username);
    return NextResponse.json({ token, roomName: room.name ?? room.slug });
  } catch (err) {
    console.error("[token] failed to mint access token:", err);
    return NextResponse.json({ error: "Failed to create access token." }, { status: 500 });
  }
}
