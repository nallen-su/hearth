-- 0002_rooms: rooms + invite links (M5, FR-1..FR-5).

CREATE TABLE rooms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- LiveKit room name + what's shown in the UI. Unguessable-ish, but NOT the join
  -- credential (the invite token is). Friendly for named rooms.
  slug             text UNIQUE NOT NULL,
  -- Optional display name for named ("not instant") meetings.
  name             text,
  max_participants integer NOT NULL DEFAULT 100,
  created_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz
);

-- The shareable credential. A room can have multiple over time (regenerate/rotate).
CREATE TABLE invite_links (
  token       text PRIMARY KEY,
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  expires_at  timestamptz,        -- NULL = never expires
  revoked_at  timestamptz,        -- NULL = active
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_links_room ON invite_links(room_id);
