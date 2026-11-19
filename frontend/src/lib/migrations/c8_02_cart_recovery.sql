-- Cart recovery state saved in Supabase (was in server memory only and lost on restart).
CREATE TABLE IF NOT EXISTS public.cart_recovery (
  cart_id     text PRIMARY KEY,
  record      jsonb NOT NULL,
  status      text,
  phone       text,
  branch_id   text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cart_recovery_status_idx ON public.cart_recovery (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.cart_recovery_event (
  id          text PRIMARY KEY,
  cart_id     text NOT NULL,
  event       jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cart_recovery_event_cart_idx ON public.cart_recovery_event (cart_id, created_at DESC);

ALTER TABLE public.cart_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_recovery_event ENABLE ROW LEVEL SECURITY;
