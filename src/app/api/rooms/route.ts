import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/rooms  { name?: string }
 *
 * Creates a meeting (instant if no name, named otherwise) plus its invite link.
 * Returns the invite token; the client navigates to /room/<token>.
 */
export async function POST(req: NextRequest) {
  let name: string | undefined;
  let waitingEnabled = false;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.name === "string") name = body.name;
    waitingEnabled = Boolean(body?.waitingEnabled);
  } catch {
    /* empty/invalid body is fine — treated as an instant meeting */
  }

  if (name && name.length > 80) {
    return NextResponse.json({ error: "Meeting name is too long." }, { status: 400 });
  }

  try {
    const { token, hostKey, room } = await createRoom({ name, waitingEnabled });
    // hostKey is returned once to the creator; the client stores it locally and uses it
    // to authorize host controls. It is never part of the shareable invite link.
    return NextResponse.json(
      { token, hostKey, roomName: room.name ?? room.slug },
      { status: 201 },
    );
  } catch (err) {
    console.error("[rooms] failed to create room:", err);
    return NextResponse.json({ error: "Failed to create the meeting." }, { status: 500 });
  }
}
