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
export async function createRoom(opts: { name?: string } = {}): Promise<{
  room: Room;
  token: string;
}> {
  const pool = getPool();
  const maxParticipants = getConfig().meeting.maxParticipants;
  const name = opts.name?.trim() || null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug(name ?? undefined);
    try {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO rooms (slug, name, max_participants) VALUES ($1, $2, $3) RETURNING id`,
        [slug, name, maxParticipants],
      );
      const roomId = rows[0]!.id;
      const token = generateToken();
      await pool.query(`INSERT INTO invite_links (token, room_id) VALUES ($1, $2)`, [
        token,
        roomId,
      ]);
      return { room: { id: roomId, slug, name, maxParticipants }, token };
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
  | { ok: false; reason: "not_found" | "revoked" | "expired" };

/** Resolve an invite token to its room, validating it's active and unexpired. */
export async function resolveInvite(token: string): Promise<InviteResolution> {
  const { rows } = await getPool().query<{
    id: string;
    slug: string;
    name: string | null;
    max_participants: number;
    expires_at: Date | null;
    revoked_at: Date | null;
  }>(
    `SELECT r.id, r.slug, r.name, r.max_participants, l.expires_at, l.revoked_at
       FROM invite_links l JOIN rooms r ON r.id = l.room_id
      WHERE l.token = $1`,
    [token],
  );

  const row = rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.revoked_at) return { ok: false, reason: "revoked" };
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
    },
  };
}

/** Revoke an invite link so it can no longer be used to join (FR-4). */
export async function revokeInvite(token: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE invite_links SET revoked_at = now() WHERE token = $1 AND revoked_at IS NULL`,
    [token],
  );
  return (rowCount ?? 0) > 0;
}
