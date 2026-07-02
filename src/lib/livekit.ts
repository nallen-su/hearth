/**
 * Server-side LiveKit helpers.
 *
 * Access tokens are minted here only — the API key/secret never reach the client
 * (see CLAUDE.md). Tokens are short-lived and scoped to a single room.
 *
 * v1 grants every joiner publish + subscribe rights; per-role permissions (host vs.
 * guest, server-authoritative controls) arrive with M6.
 */
import { AccessToken, DataPacket_Kind, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { getConfig } from "@/lib/config";

export type Role = "host" | "guest" | "waiting";

let roomService: RoomServiceClient | null = null;

function getRoomService(): RoomServiceClient {
  if (!roomService) {
    const { livekit } = getConfig();
    roomService = new RoomServiceClient(livekit.httpUrl, livekit.apiKey, livekit.apiSecret);
  }
  return roomService;
}

/**
 * Current participant count in a LiveKit room. Returns 0 if the room doesn't exist yet
 * (LiveKit creates rooms lazily on first join), so an empty room reads as 0 rather than
 * throwing. Used for server-side cap enforcement (FR-5).
 */
export async function countParticipants(roomName: string): Promise<number> {
  try {
    const participants = await getRoomService().listParticipants(roomName);
    return participants.length;
  } catch {
    return 0;
  }
}

/** How long a freshly minted join token is valid. */
const TOKEN_TTL = "15m";

/**
 * Mint a join token for `displayName` in `room`.
 *
 * Identity is made unique (display name + random suffix) so the same person can open
 * multiple tabs without LiveKit treating them as one participant — which also makes
 * two-tab local testing painless. `role` is carried in participant metadata for UI
 * (host badge, who-can-control); actual host authority is enforced server-side via the
 * host key, never this token.
 */
export async function createParticipantToken(
  room: string,
  displayName: string,
  role: Role = "guest",
): Promise<string> {
  const { livekit } = getConfig();

  const identity = `${displayName}__${crypto.randomUUID().slice(0, 8)}`;
  // A waiting participant is connected but isolated: can't publish, subscribe, or send
  // data until the host admits them (which upgrades these via updateParticipant).
  const active = role !== "waiting";

  const at = new AccessToken(livekit.apiKey, livekit.apiSecret, {
    identity,
    name: displayName,
    ttl: TOKEN_TTL,
    metadata: JSON.stringify({ role }),
  });

  at.addGrant({
    roomJoin: true,
    room,
    canPublish: active,
    canSubscribe: active,
    canPublishData: active,
    // Required for participants to set their own attributes (raise-hand state, M4).
    canUpdateOwnMetadata: active,
  });

  return at.toJwt();
}

/** Admit a waiting participant: grant publish/subscribe and flip their role to guest. */
export async function admitParticipant(room: string, identity: string): Promise<void> {
  await getRoomService().updateParticipant(
    room,
    identity,
    JSON.stringify({ role: "guest" }),
    { canPublish: true, canSubscribe: true, canPublishData: true, canUpdateMetadata: true },
  );
}

/** Admit everyone currently waiting in the room. */
export async function admitAllWaiting(room: string): Promise<void> {
  const participants = await getRoomService().listParticipants(room);
  await Promise.all(
    participants
      .filter((p) => {
        try {
          return JSON.parse(p.metadata || "{}").role === "waiting";
        } catch {
          return false;
        }
      })
      .map((p) => admitParticipant(room, p.identity).catch(() => undefined)),
  );
}

// --- Host admin actions (server-authoritative; callers must be verified hosts) ---

/** Find a participant's published track sid for a given source, or null. */
async function findTrackSid(
  room: string,
  identity: string,
  source: TrackSource,
): Promise<string | null> {
  const p = await getRoomService().getParticipant(room, identity);
  return p.tracks.find((t) => t.source === source)?.sid ?? null;
}

/** Mute a participant's microphone (they can unmute themselves again). */
export async function muteParticipantMic(room: string, identity: string): Promise<void> {
  const sid = await findTrackSid(room, identity, TrackSource.MICROPHONE);
  if (sid) await getRoomService().mutePublishedTrack(room, identity, sid, true);
}

/** Mute everyone's mic except `exceptIdentity` (the host). */
export async function muteEveryoneExcept(room: string, exceptIdentity: string): Promise<void> {
  const participants = await getRoomService().listParticipants(room);
  await Promise.all(
    participants
      .filter((p) => p.identity !== exceptIdentity)
      .map((p) => muteParticipantMic(room, p.identity).catch(() => undefined)),
  );
}

/** Mute a participant's screen-share track (FR-13 host-side stop). */
export async function stopParticipantShare(room: string, identity: string): Promise<void> {
  const sid = await findTrackSid(room, identity, TrackSource.SCREEN_SHARE);
  if (sid) await getRoomService().mutePublishedTrack(room, identity, sid, true);
}

export async function removeParticipant(room: string, identity: string): Promise<void> {
  await getRoomService().removeParticipant(room, identity);
}

/** Reflect room flags (lock, waiting room) in LiveKit metadata so clients see them live. */
export async function setRoomMetadata(
  room: string,
  flags: { locked: boolean; waitingEnabled: boolean },
): Promise<void> {
  try {
    await getRoomService().updateRoomMetadata(room, JSON.stringify(flags));
  } catch {
    // Room may not exist in LiveKit yet (nobody joined) — DB state still applies.
  }
}

/** End the meeting for everyone by deleting the LiveKit room. */
export async function endRoom(room: string): Promise<void> {
  try {
    await getRoomService().deleteRoom(room);
  } catch {
    /* already gone */
  }
}

/** Liveness check for the LiveKit server API (health endpoint). */
export async function pingLiveKit(): Promise<boolean> {
  await getRoomService().listRooms();
  return true;
}

/** Set a participant's role in their LiveKit metadata (host badge / client role, FR-23). */
export async function setParticipantRole(room: string, identity: string, role: Role): Promise<void> {
  await getRoomService().updateParticipant(room, identity, JSON.stringify({ role }));
}

/**
 * Deliver a co-host grant/revoke to a single participant over the data channel. The
 * grant carries the co-host key (server-minted); only the target identity receives it.
 */
export async function sendHostRole(
  room: string,
  identity: string,
  payload: { type: "grant"; key: string } | { type: "revoke" },
): Promise<void> {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  await getRoomService().sendData(room, data, DataPacket_Kind.RELIABLE, {
    destinationIdentities: [identity],
    topic: "host_role",
  });
}
