-- Telemarketing reorder reminders (call list) persisted in the database. Previously they lived only in
-- server memory, so call notes, statuses and assignments were lost on every restart/redeploy.
BEGIN;
CREATE TABLE IF NOT EXISTS public.telemarketing_candidate (
  id              TEXT PRIMARY KEY,
  dedupe_key      TEXT NOT NULL UNIQUE,
  customer_uid    TEXT,
  expected_date   DATE,
  priority        TEXT,
  contact_status  TEXT,
  data            JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tm_candidate_expected ON public.telemarketing_candidate (expected_date);
CREATE INDEX IF NOT EXISTS idx_tm_candidate_customer ON public.telemarketing_candidate (customer_uid);
COMMIT;
