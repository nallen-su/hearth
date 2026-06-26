-- 0004_waiting_room: per-room waiting-room toggle (M6 part 2, FR-20).

ALTER TABLE rooms ADD COLUMN waiting_enabled boolean NOT NULL DEFAULT false;
