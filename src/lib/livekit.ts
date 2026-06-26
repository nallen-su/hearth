/**
 * Server-side LiveKit helpers.
 *
 * Access tokens are minted here only — the API key/secret never reach the client
 * (see CLAUDE.md). Tokens are short-lived and scoped to a single room.
 *
 * v1 grants every joiner publish + subscribe rights; per-role permissions (host vs.
 * guest, server-authoritative controls) arrive with M6.
 */
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { getConfig } from "@/lib/config";

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
 * two-tab local testing painless.
 */
export async function createParticipantToken(room: string, displayName: string): Promise<string> {
  const { livekit } = getConfig();

  const identity = `${displayName}__${crypto.randomUUID().slice(0, 8)}`;

  const at = new AccessToken(livekit.apiKey, livekit.apiSecret, {
    identity,
    name: displayName,
    ttl: TOKEN_TTL,
  });

  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Required for participants to set their own attributes (raise-hand state, M4).
    canUpdateOwnMetadata: true,
  });

  return at.toJwt();
}
