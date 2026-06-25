import { NextRequest, NextResponse } from "next/server";
import { createParticipantToken } from "@/lib/livekit";

// livekit-server-sdk needs the Node runtime; never run on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/token?room=<room>&username=<displayName>
 * Returns a short-lived, room-scoped LiveKit access token for the client to connect with.
 */
export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room")?.trim();
  const username = req.nextUrl.searchParams.get("username")?.trim();

  if (!room || !username) {
    return NextResponse.json(
      { error: "Both 'room' and 'username' query parameters are required." },
      { status: 400 },
    );
  }

  try {
    const token = await createParticipantToken(room, username);
    return NextResponse.json({ token });
  } catch (err) {
    console.error("[token] failed to mint access token:", err);
    return NextResponse.json({ error: "Failed to create access token." }, { status: 500 });
  }
}
