/**
 * Rooms + invite links (M5). Server-only data access for creating meetings, resolving
 * invite tokens, and revoking links. The invite token is the join credential; the room
 * slug is the LiveKit room name and display label.
 */
import { randomBytes } from "node:crypto";
import { getPool } from "@/lib/db";
import { getConfig } from "@/lib/config";

export interface Room {
  id: string;
  slug: string;
  name: string | null;
  maxParticipants: number;
  locked: boolean;
  waitingEnabled: boolean;
}

/** Unguessable invite token (~22 url-safe chars). */
function generateToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Friendly, mostly-unique room slug used as the LiveKit room name. */
function generateSlug(name?: string): string {
  const suffix = randomBytes(3).toString("hex"); // 6 hex chars
  if (name) {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    return base ? `${base}-${suffix}` : `room-${suffix}`;
  }
  return `room-${suffix}`;
}

/**
 * Create a room (instant if no name, named otherwise) plus its first invite link.
 * Retries once on the unlikely slug collision.
 */
export async function createRoom(
  opts: { name?: string; waitingEnabled?: boolean } = {},
): Promise<{
  room: Room;
  token: string;
  hostKey: string;
}> {
  const pool = getPool();
  const maxParticipants = getConfig().meeting.maxParticipants;
  const name = opts.name?.trim() || null;
  const waitingEnabled = Boolean(opts.waitingEnabled);
  const hostKey = generateToken();

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug(name ?? undefined);
    try {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO rooms (slug, name, max_participants, host_key, waiting_enabled)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [slug, name, maxParticipants, hostKey, waitingEnabled],
      );
      const roomId = rows[0]!.id;
      const token = generateToken();
      await pool.query(`INSERT INTO invite_links (token, room_id) VALUES ($1, $2)`, [
        token,
        roomId,
      ]);
      return {
        room: { id: roomId, slug, name, maxParticipants, locked: false, waitingEnabled },
        token,
        hostKey,
      };
    } catch (err) {
      // 23505 = unique_violation (slug collision) — retry with a new slug.
      if ((err as { code?: string }).code === "23505" && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("Failed to create room after retries");
}

export type InviteResolution =
  | { ok: true; room: Room }
  | { ok: false; reason: "not_found" | "revoked" | "expired" | "ended" };

/** Resolve an invite token to its room, validating it's active, unexpired, and not ended. */
export async function resolveInvite(token: string): Promise<InviteResolution> {
  const { rows } = await getPool().query<{
    id: string;
    slug: string;
    name: string | null;
    max_participants: number;
    locked: boolean;
    waiting_enabled: boolean;
    ended_at: Date | null;
    expires_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT r.id, r.slug, r.name, r.max_participants, r.locked, r.waiting_enabled, r.ended_at,
            l.expires_at, l.revoked_at
       FROM invite_links l JOIN rooms r ON r.id = l.room_id
      WHERE l.token = $1`,
    [token],
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.revoked_at) return { ok: false, reason: "revoked" };
  if (row.ended_at) return { ok: false, reason: "ended" };
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    room: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      maxParticipants: row.max_participants,
      locked: row.locked,
      waitingEnabled: row.waiting_enabled,
    },
  };
}

/**
 * Verify a host key against an invite token's room. Returns the room when the key
 * matches (the caller is the host), else null. Server-authoritative gate for host
 * controls — never trust a client-asserted role.
 */
export async function verifyHost(token: string, hostKey: string): Promise<Room | null> {
  if (!hostKey) return null;
  const { rows } = await getPool().query<{
    id: string;
    slug: string;
    name: string | null;
    max_participants: number;
    locked: boolean;
    waiting_enabled: boolean;
    host_key: string | null;
  }>(
    `SELECT r.id, r.slug, r.name, r.max_participants, r.locked, r.waiting_enabled, r.host_key
       FROM invite_links l JOIN rooms r ON r.id = l.room_id
      WHERE l.token = $1`,
    [token],
  );
  const row = rows[0];
  if (!row || !row.host_key || row.host_key !== hostKey) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    maxParticipants: row.max_participants,
    locked: row.locked,
    waitingEnabled: row.waiting_enabled,
  };
}

export async function setRoomLocked(roomId: string, locked: boolean): Promise<void> {
  await getPool().query(`UPDATE rooms SET locked = $2 WHERE id = $1`, [roomId, locked]);
}

export async function setWaitingEnabled(roomId: string, enabled: boolean): Promise<void> {
  await getPool().query(`UPDATE rooms SET waiting_enabled = $2 WHERE id = $1`, [roomId, enabled]);
}

export async function markRoomEnded(roomId: string): Promise<void> {
  await getPool().query(`UPDATE rooms SET ended_at = now() WHERE id = $1 AND ended_at IS NULL`, [
    roomId,
  ]);
}

/** Revoke an invite link so it can no longer be used to join (FR-4). */
export async function revokeInvite(token: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE invite_links SET revoked_at = now() WHERE token = $1 AND revoked_at IS NULL`,
    [token],
  );
  return (rowCount ?? 0) > 0;
}
