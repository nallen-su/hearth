-- 0001_init: foundation migration (M0).
-- The domain schema (rooms, invite links, participants) lands in M5. For now we only
-- enable the extensions later migrations will rely on.

-- gen_random_uuid() for primary keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
