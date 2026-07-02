import { NextRequest, NextResponse } from "next/server";
import {
  verifyHost,
  setRoomLocked,
  setWaitingEnabled,
  markRoomEnded,
  addCoHostKey,
  revokeCoHost,
} from "@/lib/rooms";
import { logger } from "@/lib/logger";
import {
  muteParticipantMic,
  muteEveryoneExcept,
  stopParticipantShare,
  removeParticipant,
  admitParticipant,
  admitAllWaiting,
  setParticipantRole,
  sendHostRole,
  setRoomMetadata,
  endRoom,
} from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | "mute"
  | "mute_all"
  | "remove"
  | "stop_share"
  | "lock"
  | "unlock"
  | "end"
  | "admit"
  | "admit_all"
  | "enable_waiting"
  | "disable_waiting"
  | "promote"
  | "demote";

/**
 * POST /api/host  { invite, hostKey, action, targetIdentity? }
 *
 * Server-authoritative host controls (FR-20/21/22). The host key is verified against the
 * room before any LiveKit admin action runs — the client's asserted role is never trusted.
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

  const needsTarget: Action[] = ["mute", "remove", "stop_share", "admit", "promote", "demote"];
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
      case "admit":
        await admitParticipant(room.slug, targetIdentity!);
        break;
      case "admit_all":
        await admitAllWaiting(room.slug);
        break;
      case "lock":
      case "unlock": {
        const locked = action === "lock";
        await setRoomLocked(room.id, locked);
        await setRoomMetadata(room.slug, { locked, waitingEnabled: room.waitingEnabled });
        break;
      }
      case "enable_waiting":
      case "disable_waiting": {
        const enabled = action === "enable_waiting";
        await setWaitingEnabled(room.id, enabled);
        await setRoomMetadata(room.slug, { locked: room.locked, waitingEnabled: enabled });
        break;
      }
      case "promote": {
        // Mint a co-host key, mark them host, and deliver the key to just that person.
        const key = await addCoHostKey(room.id, targetIdentity!);
        await setParticipantRole(room.slug, targetIdentity!, "host");
        await sendHostRole(room.slug, targetIdentity!, { type: "grant", key });
        break;
      }
      case "demote": {
        // Only affects actual co-hosts — protects the primary host from being demoted.
        const revoked = await revokeCoHost(room.id, targetIdentity!);
        if (revoked > 0) {
          await setParticipantRole(room.slug, targetIdentity!, "guest");
          await sendHostRole(room.slug, targetIdentity!, { type: "revoke" });
        }
        break;
      }
      case "end":
        await markRoomEnded(room.id);
        await endRoom(room.slug);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    logger.info("host action", { room: room.slug, action });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("host action failed", { room: room.slug, action, err: String(err) });
    return NextResponse.json({ error: "Host action failed." }, { status: 500 });
  }
}
