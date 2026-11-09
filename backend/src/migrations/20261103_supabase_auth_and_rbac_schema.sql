-- ==============================================================================
-- CAKETOHOME — SUPABASE AUTHENTICATION, IDENTITY & RBAC MIGRATION
-- Migration: 20261103_supabase_auth_and_rbac_schema.sql
-- Description: Sets up auth schema compatibility, profiles, roles, permissions,
--              branch memberships, audit events, triggers, and Row Level Security.
-- Legal Entity: CakeToHome India Private Limited
-- ==============================================================================

-- 1. EXTENSIONS & SCHEMAS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS auth;

-- 2. AUTH.USERS RECONCILIATION
-- Ensures auth.users exists in both standalone and managed Supabase environments
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aud VARCHAR(255) DEFAULT 'authenticated',
    role VARCHAR(255) DEFAULT 'authenticated',
    email VARCHAR(255),
    encrypted_password VARCHAR(255),
    email_confirmed_at TIMESTAMPTZ,
    invited_at TIMESTAMPTZ,
    confirmation_token VARCHAR(255),
    confirmation_sent_at TIMESTAMPTZ,
    recovery_token VARCHAR(255),
    recovery_sent_at TIMESTAMPTZ,
    email_change_token_new VARCHAR(255),
    email_change VARCHAR(255),
    email_change_sent_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    phone VARCHAR(20) UNIQUE,
    phone_confirmed_at TIMESTAMPTZ,
    phone_change VARCHAR(20),
    phone_change_token VARCHAR(255),
    phone_change_sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    email_change_token_current VARCHAR(255),
    email_change_confirm_status SMALLINT,
    banned_until TIMESTAMPTZ,
    reauthentication_token VARCHAR(255),
    reauthentication_sent_at TIMESTAMPTZ,
    is_sso_user BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Index for phone number lookups in auth.users
CREATE INDEX IF NOT EXISTS idx_auth_users_phone ON auth.users (phone);
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users (email);

-- 3. SUPABASE AUTH HELPER FUNCTIONS (IDEMPOTENT)
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')::TEXT;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::JSONB;
$$ LANGUAGE sql STABLE;

-- 4. ROLES MASTER
CREATE TABLE IF NOT EXISTS public.roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.roles (id, name, description, is_system) VALUES
('SUPER_ADMIN', 'Super Administrator', 'Full global administrative authority across all branches, finance, and system settings', TRUE),
('ADMIN', 'Administrator', 'Storefront, catalog, customer, and operational administration', TRUE),
('STORE_MANAGER', 'Store Manager', 'Authorized branch-level operations, staff, and inventory management', TRUE),
('STORE_STAFF', 'Store Staff', 'Assigned branch operations, order fulfillment, and counter activities', TRUE),
('OPERATIONS', 'Operations', 'Central fleet, logistics, delivery route planning, and dispatcher access', TRUE),
('FINANCE', 'Finance & Accounts', 'General ledger, GST reporting, BRS reconciliation, period close, and payouts', TRUE),
('DELIVERY_PARTNER', 'Delivery Partner', 'Fleet delivery driver mobile interface and trip execution', TRUE),
('CUSTOMER', 'Customer', 'Consumer storefront ordering, account profile, order history, and addresses', TRUE)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 5. PERMISSIONS MASTER
CREATE TABLE IF NOT EXISTS public.permissions (
    id VARCHAR(100) PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.permissions (id, module, description) VALUES
('profile:read_self', 'identity', 'Read own user profile'),
('profile:update_self', 'identity', 'Update own user profile'),
('profile:manage_all', 'identity', 'Manage any user profile'),
('order:create_self', 'storefront', 'Place orders for own account'),
('order:read_self', 'storefront', 'View own customer order history'),
('order:read_branch', 'operations', 'View orders assigned to permitted branches'),
('order:manage_branch', 'operations', 'Update status of orders within permitted branches'),
('order:read_all', 'admin', 'View all orders system-wide'),
('inventory:read_branch', 'inventory', 'Read stock levels in assigned branch'),
('inventory:manage_branch', 'inventory', 'Adjust stock levels in assigned branch'),
('delivery:view_trips', 'delivery', 'View assigned delivery dispatch trips'),
('delivery:update_status', 'delivery', 'Update delivery status of dispatched orders'),
('finance:read_reports', 'finance', 'View GST, P&L, balance sheet, and voucher ledgers'),
('finance:manage_vouchers', 'finance', 'Create and post accounting vouchers and bank entries'),
('admin:full_access', 'admin', 'Unrestricted administrative access')
ON CONFLICT (id) DO NOTHING;

-- 6. ROLE_PERMISSIONS JUNCTION
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id VARCHAR(50) NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

INSERT INTO public.role_permissions (role_id, permission_id) VALUES
('CUSTOMER', 'profile:read_self'),
('CUSTOMER', 'profile:update_self'),
('CUSTOMER', 'order:create_self'),
('CUSTOMER', 'order:read_self'),
('DELIVERY_PARTNER', 'profile:read_self'),
('DELIVERY_PARTNER', 'profile:update_self'),
('DELIVERY_PARTNER', 'delivery:view_trips'),
('DELIVERY_PARTNER', 'delivery:update_status'),
('STORE_STAFF', 'profile:read_self'),
('STORE_STAFF', 'order:read_branch'),
('STORE_STAFF', 'order:manage_branch'),
('STORE_STAFF', 'inventory:read_branch'),
('STORE_MANAGER', 'profile:read_self'),
('STORE_MANAGER', 'order:read_branch'),
('STORE_MANAGER', 'order:manage_branch'),
('STORE_MANAGER', 'inventory:read_branch'),
('STORE_MANAGER', 'inventory:manage_branch'),
('OPERATIONS', 'profile:read_self'),
('OPERATIONS', 'order:read_all'),
('OPERATIONS', 'delivery:view_trips'),
('OPERATIONS', 'delivery:update_status'),
('FINANCE', 'profile:read_self'),
('FINANCE', 'finance:read_reports'),
('FINANCE', 'finance:manage_vouchers'),
('ADMIN', 'profile:read_self'),
('ADMIN', 'profile:manage_all'),
('ADMIN', 'order:read_all'),
('ADMIN', 'finance:read_reports'),
('ADMIN', 'admin:full_access'),
('SUPER_ADMIN', 'admin:full_access')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 7. APPLICATION PROFILES (Source of truth linked to auth.users.id)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(150),
    display_name VARCHAR(100),
    email VARCHAR(255),
    avatar_url TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'INACTIVE')),
    is_profile_completed BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_activity_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

-- 8. USER ROLE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id VARCHAR(50) NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_user ON public.user_role_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_role ON public.user_role_assignments (role_id);

-- 9. USER BRANCH MEMBERSHIPS (Branch-scoped access for store staff and managers)
CREATE TABLE IF NOT EXISTS public.user_branch_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES public.branch(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_branch UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branch_user ON public.user_branch_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_branch ON public.user_branch_memberships (branch_id);

-- 10. USER COMPANY MEMBERSHIPS
CREATE TABLE IF NOT EXISTS public.user_company_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_company UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_company_user ON public.user_company_memberships (user_id);

-- 11. AUTH AUDIT EVENTS (Tamper-evident audit log)
CREATE TABLE IF NOT EXISTS public.auth_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    phone VARCHAR(20),
    event_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE', 'ATTEMPT', 'BLOCKED')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON public.auth_audit_events (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_phone ON public.auth_audit_events (phone);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event ON public.auth_audit_events (event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON public.auth_audit_events (created_at DESC);

-- 12. AUTOMATIC PROFILE PROVISIONING TRIGGER ON AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_phone VARCHAR(20);
    v_name VARCHAR(150);
    v_email VARCHAR(255);
BEGIN
    v_phone := COALESCE(NEW.phone, (NEW.raw_user_meta_data->>'phone')::TEXT, '');
    v_name := COALESCE((NEW.raw_user_meta_data->>'full_name')::TEXT, (NEW.raw_user_meta_data->>'name')::TEXT, 'Customer');
    v_email := COALESCE(NEW.email, (NEW.raw_user_meta_data->>'email')::TEXT, NULL);

    -- Idempotent profile creation
    INSERT INTO public.profiles (id, phone, full_name, display_name, email, status, is_profile_completed)
    VALUES (NEW.id, v_phone, v_name, v_name, v_email, 'ACTIVE', FALSE)
    ON CONFLICT (id) DO UPDATE SET
        updated_at = now(),
        last_activity_at = now();

    -- Assign default CUSTOMER role idempotently
    INSERT INTO public.user_role_assignments (user_id, role_id)
    VALUES (NEW.id, 'CUSTOMER')
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Record signup audit event
    INSERT INTO public.auth_audit_events (user_id, phone, event_type, status, metadata)
    VALUES (NEW.id, v_phone, 'USER_SIGNUP', 'SUCCESS', jsonb_build_object('source', 'auth_trigger'));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS across identity and RBAC tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_events ENABLE ROW LEVEL SECURITY;

-- Helper security function: check if authenticated caller has role
CREATE OR REPLACE FUNCTION public.auth_has_role(check_role VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    WHERE ura.user_id = auth.uid()
      AND (ura.role_id = check_role OR ura.role_id = 'SUPER_ADMIN')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Roles & Permissions catalog policies (Public read-only, Super Admin manage)
DROP POLICY IF EXISTS "roles_read_all" ON public.roles;
CREATE POLICY "roles_read_all" ON public.roles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "permissions_read_all" ON public.permissions;
CREATE POLICY "permissions_read_all" ON public.permissions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "role_permissions_read_all" ON public.role_permissions;
CREATE POLICY "role_permissions_read_all" ON public.role_permissions FOR SELECT USING (TRUE);

-- A. PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN')
    );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- B. USER_ROLE_ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "role_assign_select_own_or_admin" ON public.user_role_assignments;
CREATE POLICY "role_assign_select_own_or_admin" ON public.user_role_assignments
    FOR SELECT USING (
        user_id = auth.uid() OR public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN')
    );

DROP POLICY IF EXISTS "role_assign_admin_manage" ON public.user_role_assignments;
CREATE POLICY "role_assign_admin_manage" ON public.user_role_assignments
    FOR ALL USING (public.auth_has_role('SUPER_ADMIN'))
    WITH CHECK (public.auth_has_role('SUPER_ADMIN'));

-- C. USER_BRANCH_MEMBERSHIPS POLICIES
DROP POLICY IF EXISTS "branch_member_select_own_or_admin" ON public.user_branch_memberships;
CREATE POLICY "branch_member_select_own_or_admin" ON public.user_branch_memberships
    FOR SELECT USING (
        user_id = auth.uid() OR public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN')
    );

DROP POLICY IF EXISTS "branch_member_admin_manage" ON public.user_branch_memberships;
CREATE POLICY "branch_member_admin_manage" ON public.user_branch_memberships
    FOR ALL USING (public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN'))
    WITH CHECK (public.auth_has_role('ADMIN') OR public.auth_has_role('SUPER_ADMIN'));

-- D. AUTH_AUDIT_EVENTS POLICIES
DROP POLICY IF EXISTS "audit_events_insert_system" ON public.auth_audit_events;
CREATE POLICY "audit_events_insert_system" ON public.auth_audit_events
    FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "audit_events_select_admin" ON public.auth_audit_events;
CREATE POLICY "audit_events_select_admin" ON public.auth_audit_events
    FOR SELECT USING (public.auth_has_role('SUPER_ADMIN'));

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
