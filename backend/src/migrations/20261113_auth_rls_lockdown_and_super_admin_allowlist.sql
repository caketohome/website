-- CakeToHome — RLS lockdown + Super Admin allowlist (2026-11-13)
--
-- Why: every table in `public` had RLS disabled while `anon`/`authenticated` held full
-- table privileges, so the public publishable key could read/write orders, customers,
-- payment_gateway_config and grant itself SUPER_ADMIN via the Supabase Data API.
-- The app talks to Postgres as `postgres` (BYPASSRLS) through DATABASE_URL, so
-- deny-by-default RLS does not affect server code.
--
-- Idempotent. Deletes no data.

BEGIN;

-- 1. Deny-by-default on every public table and view for the Data API roles.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
      AND pg_has_role(c.relowner, 'USAGE')  -- skip extension-owned objects we cannot alter
  LOOP
    IF r.relkind IN ('r', 'p') THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', r.relname);
    ELSE
      -- Views/matviews bypass RLS: no Data API access at all.
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.relname);
    END IF;
  END LOOP;
END $$;

-- Future tables created by `postgres` must not silently re-open the hole.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;

-- 2. Read-only self policies (writes only happen server-side).
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS user_role_assignments_select_own ON public.user_role_assignments;
CREATE POLICY user_role_assignments_select_own ON public.user_role_assignments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
CREATE POLICY roles_select_authenticated ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS permissions_select_authenticated ON public.permissions;
CREATE POLICY permissions_select_authenticated ON public.permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS role_permissions_select_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_select_authenticated ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- 3. Trusted Super Admin allowlist. Server-only (no Data API access).
--    A listed phone gets SUPER_ADMIN only after Supabase Auth verifies an OTP for it.
CREATE TABLE IF NOT EXISTS public.super_admin_allowlist (
  phone      varchar(16) PRIMARY KEY CHECK (phone ~ '^\+91[6-9][0-9]{9}$'),
  label      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.super_admin_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.super_admin_allowlist FROM anon, authenticated;

INSERT INTO public.super_admin_allowlist (phone, label) VALUES
  ('+917994821555', 'Baked DM'),
  ('+917034021555', 'Baked GM'),
  ('+919567789888', 'CakeToHome Admin'),
  ('+919605725337', 'Alex — Programmer'),
  ('+919539938305', 'Vighnesh — Founder')
ON CONFLICT (phone) DO NOTHING;

-- 4. Anchor new profiles to Supabase Auth identities. NOT VALID: the 6 legacy
--    pre-auth rows are kept; every new/re-keyed row must match auth.users.
--    RESTRICT: deleting an auth user never cascades into business data.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_auth_users_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_auth_users_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

COMMIT;
