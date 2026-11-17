-- Search admin settings (ranking weights, tags, synonyms, pin/boost/bury rules).
-- Previously held only in server memory and lost on every restart/deploy.
-- Single row (id = 'default'); the app server reads it on startup and writes it on each admin change.
CREATE TABLE IF NOT EXISTS public.search_setting (
  id          TEXT PRIMARY KEY,
  weights     JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  synonyms    JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.search_setting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_setting FROM anon, authenticated;
