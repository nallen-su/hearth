import { NextRequest, NextResponse } from "next/server";
import { verifyHost, setRoomLocked, markRoomEnded } from "@/lib/rooms";
import {
  muteParticipantMic,
  muteEveryoneExcept,
  stopParticipantShare,
  removeParticipant,
  setRoomMetadataLocked,
  endRoom,
} from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "mute" | "mute_all" | "remove" | "stop_share" | "lock" | "unlock" | "end";

/**
 * POST /api/host  { invite, hostKey, action, targetIdentity? }
 *
 * Server-authoritative host controls (FR-21/22). The host key is verified against the
 * room before any LiveKit admin action runs — the client's asserted role is never
 * trusted. `mute_all` excludes the host's own identity (targetIdentity).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    invite?: string;
    hostKey?: string;
    action?: Action;
    targetIdentity?: string;
  };
  const { invite, hostKey, action, targetIdentity } = body;

  if (!invite || !hostKey || !action) {
    return NextResponse.json(
      { error: "invite, hostKey, and action are required." },
      { status: 400 },
    );
  }

  const room = await verifyHost(invite, hostKey);
  if (!room) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const needsTarget: Action[] = ["mute", "remove", "stop_share"];
  if (needsTarget.includes(action) && !targetIdentity) {
    return NextResponse.json({ error: "targetIdentity is required." }, { status: 400 });
  }

  try {
    switch (action) {
      case "mute":
        await muteParticipantMic(room.slug, targetIdentity!);
        break;
      case "mute_all":
        // targetIdentity = the host's own identity, excluded from the mute.
        await muteEveryoneExcept(room.slug, targetIdentity ?? "");
        break;
      case "remove":
        await removeParticipant(room.slug, targetIdentity!);
        break;
      case "stop_share":
        await stopParticipantShare(room.slug, targetIdentity!);
        break;
      case "lock":
      case "unlock":
        await setRoomLocked(room.id, action === "lock");
        await setRoomMetadataLocked(room.slug, action === "lock");
        break;
      case "end":
        await markRoomEnded(room.id);
        await endRoom(room.slug);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[host] action '${action}' failed:`, err);
    return NextResponse.json({ error: "Host action failed." }, { status: 500 });
  }
}
