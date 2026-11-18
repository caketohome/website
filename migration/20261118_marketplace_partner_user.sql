-- Partner portal logins: an admin grants a partner contact's phone access; that phone then signs in by
-- OTP with role PARTNER_OWNER scoped to its partner. One active grant per phone.
BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_partner_user (
  id TEXT PRIMARY KEY DEFAULT ('mpu_' || gen_random_uuid()::text),
  partner_id TEXT NOT NULL REFERENCES public.marketplace_partner(id) ON DELETE RESTRICT,
  phone TEXT NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  name TEXT,
  role TEXT NOT NULL DEFAULT 'PARTNER_OWNER' CHECK (role IN ('PARTNER_OWNER', 'PARTNER_ADMIN')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_by TEXT NOT NULL,
  revoked_by TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_partner_user_active_phone
  ON public.marketplace_partner_user(phone) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_marketplace_partner_user_partner ON public.marketplace_partner_user(partner_id);

COMMIT;
