-- Web Push subscriptions (PWA notifications) for customers, branch managers and delivery partners.
-- One row per browser/device endpoint. The app server (DATABASE_URL role) reads/writes it;
-- RLS is on with no policies so the Supabase anon/authenticated APIs can't touch it.
CREATE TABLE IF NOT EXISTS public.push_subscription (
  id           BIGSERIAL PRIMARY KEY,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  role         TEXT NOT NULL,
  branch_id    TEXT,
  partner_id   TEXT,
  customer_uid TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscription_customer_idx ON public.push_subscription (customer_uid);
CREATE INDEX IF NOT EXISTS push_subscription_branch_role_idx ON public.push_subscription (branch_id, role);
CREATE INDEX IF NOT EXISTS push_subscription_partner_idx ON public.push_subscription (partner_id);

ALTER TABLE public.push_subscription ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscription FROM anon, authenticated;
