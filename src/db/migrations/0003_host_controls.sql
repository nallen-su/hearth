-- 0003_host_controls: host identity + lock state (M6).

-- The creator's secret. Returned once at creation, stored in the creator's browser, and
-- required by host-control endpoints. NOT shareable like the invite token.
ALTER TABLE rooms ADD COLUMN host_key text;

-- When locked, new participants can't join (existing ones stay). FR-22.
ALTER TABLE rooms ADD COLUMN locked boolean NOT NULL DEFAULT false;
