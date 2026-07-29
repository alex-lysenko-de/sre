-- =========================================
-- CHECKPOINTS - submit_scan_packet() EXTENSION (Ticket 131)
-- =========================================
-- Extends submit_scan_packet() (doc/db/scan_packets.sql) with the
-- auto-create-or-find rule specified in tickets/130/IMPLEMENTATION_PLAN.md
-- ("submit_scan_packet() - правило приёма") and tickets/130/decision.md
-- (п.1, п.5): a packet is NEVER rejected for lacking an open checkpoint -
-- the counselor-facing client contract (src/composables/useScanPacket.js,
-- ticket 120) does not change at all.
--
-- This file is a full CREATE OR REPLACE of submit_scan_packet() (Postgres
-- has no "ALTER FUNCTION ... ADD lines" - the whole body is reproduced,
-- unchanged except for the checkpoint auto-create/find block and passing
-- checkpoint_id into the scan_packets INSERT). Apply AFTER
-- doc/db/checkpoints.sql (needs public.checkpoints to exist and
-- scan_packets.checkpoint_id to exist). Safe to re-run.

CREATE OR REPLACE FUNCTION submit_scan_packet(payload jsonb)
RETURNS TABLE(packet_id bigint, created boolean) AS $$
DECLARE
  v_packet_id bigint;
  v_client_packet_id uuid := (payload->>'client_packet_id')::uuid;
  v_type smallint := (payload->>'type_code')::smallint;
  v_date character varying := payload->>'date';
  v_checkpoint_id bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'children', '[]'::jsonb)) AS c
    WHERE NULLIF(c->>'child_id', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Packet children[] contains an entry without child_id - payload malformed';
  END IF;

  -- Ticket 131: find the open checkpoint of this type/day, or create it if
  -- none exists yet - atomic "find-or-create", never a rejection. ON
  -- CONFLICT targets the same partial unique index that enforces "one open
  -- checkpoint per type per day" (idx_checkpoints_one_open_per_type_per_day,
  -- doc/db/checkpoints.sql) - at a race between two counselors sending the
  -- first packet of a type simultaneously, one INSERT wins, the other is a
  -- silent no-op.
  INSERT INTO checkpoints (type, day, status, created_by)
  VALUES (v_type, v_date, 1, (payload->>'author_id')::bigint)
  ON CONFLICT (day, type) WHERE status = 1 DO NOTHING;

  -- ORDER BY id DESC is a guard for the exceptional "two open checkpoints of
  -- the same type" state (tickets/130/decision.md, п.6 - only reachable via
  -- manual DB intervention, never through normal UI flow): incoming packets
  -- attach to the most recently opened one.
  SELECT id INTO v_checkpoint_id
  FROM checkpoints
  WHERE day = v_date AND type = v_type AND status = 1
  ORDER BY id DESC
  LIMIT 1;

  INSERT INTO scan_packets (
    client_packet_id, type, author_id, bus_id, group_id,
    date, started_at, finished_at, children_count, checkpoint_id
  )
  VALUES (
    v_client_packet_id,
    v_type,
    (payload->>'author_id')::bigint,
    NULLIF(payload->>'bus_id', '')::smallint,
    NULLIF(payload->>'group_id', '')::smallint,
    v_date,
    NULLIF(payload->>'started_at', '')::timestamptz,
    (payload->>'finished_at')::timestamptz,
    jsonb_array_length(COALESCE(payload->'children', '[]'::jsonb)),
    v_checkpoint_id
  )
  ON CONFLICT (client_packet_id) DO NOTHING
  RETURNING id INTO v_packet_id;

  IF v_packet_id IS NULL THEN
    -- Already exists: either a retry after a lost response, or a race
    -- between two simultaneous retries (either way - do not create again).
    SELECT id INTO v_packet_id FROM scan_packets WHERE client_packet_id = v_client_packet_id;
    RETURN QUERY SELECT v_packet_id, false;
    RETURN;
  END IF;

  INSERT INTO scans (date, user_id, child_id, bus_id, type, packet_id, method, created_at)
  SELECT
    payload->>'date',
    (payload->>'author_id')::bigint,
    (c->>'child_id')::bigint,
    NULLIF(payload->>'bus_id', '')::smallint,
    1,
    v_packet_id,
    CASE WHEN c->>'method' = 'MANUAL' THEN 2 ELSE 1 END,
    COALESCE(NULLIF(c->>'timestamp', '')::timestamptz, now())
  FROM jsonb_array_elements(COALESCE(payload->'children', '[]'::jsonb)) AS c;

  RETURN QUERY SELECT v_packet_id, true;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- End of migration
-- =========================================
