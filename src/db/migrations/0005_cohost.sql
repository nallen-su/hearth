-- 0005_cohost: additional host keys for co-hosts (FR-23).
-- The room's original host_key stays the "primary"; promoting a participant mints an
-- extra key here, tied to their identity so it can be revoked on demote. Any non-revoked
-- key (primary or co-host) authorizes host actions.

CREATE TABLE host_keys (
  key         text PRIMARY KEY,
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  identity    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

CREATE INDEX idx_host_keys_room ON host_keys(room_id);
