# CakeToHome — User Identity Database Schema

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Target Schema:** `public` and `auth`  

---

## 1. Schema Definitions

### 1.1 `auth.users` (Authoritative Identity Anchor)
Standard Supabase Auth core identity table.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `phone` (VARCHAR(20), Unique, E.164 format)
- `email` (VARCHAR(255))
- `raw_user_meta_data` (JSONB)
- `raw_app_meta_data` (JSONB)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `last_sign_in_at` (TIMESTAMPTZ)

### 1.2 `public.profiles` (Application Profile)
Linked 1:1 to `auth.users.id`.
- `id` (UUID, Primary Key, FK $\rightarrow$ `auth.users.id` ON DELETE CASCADE)
- `phone` (VARCHAR(20), NOT NULL, Unique, E.164)
- `full_name` (VARCHAR(150))
- `display_name` (VARCHAR(100))
- `email` (VARCHAR(255))
- `avatar_url` (TEXT)
- `status` (VARCHAR(30), Default: `'ACTIVE'`, Check: `status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'INACTIVE')`)
- `is_profile_completed` (BOOLEAN, Default: `FALSE`)
- `preferences` (JSONB, Default: `'{}'::jsonb`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)
- `last_activity_at` (TIMESTAMPTZ)

### 1.3 `public.roles` (System Roles Master)
- `id` (VARCHAR(50), Primary Key)
- `name` (VARCHAR(100), NOT NULL)
- `description` (TEXT)
- `is_system` (BOOLEAN, Default: `TRUE`)
- `created_at` (TIMESTAMPTZ)

### 1.4 `public.user_role_assignments` (User Role Mapping)
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, FK $\rightarrow$ `public.profiles.id` ON DELETE CASCADE)
- `role_id` (VARCHAR(50), NOT NULL, FK $\rightarrow$ `public.roles.id` ON DELETE CASCADE)
- `assigned_by` (UUID, FK $\rightarrow$ `auth.users.id` ON DELETE SET NULL)
- `assigned_at` (TIMESTAMPTZ, Default: `now()`)
- `CONSTRAINT uq_user_role UNIQUE (user_id, role_id)`

### 1.5 `public.user_branch_memberships` (Branch Scoping)
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, FK $\rightarrow$ `public.profiles.id` ON DELETE CASCADE)
- `branch_id` (TEXT, NOT NULL, FK $\rightarrow$ `public.branch.id` ON DELETE CASCADE)
- `is_primary` (BOOLEAN, Default: `FALSE`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `CONSTRAINT uq_user_branch UNIQUE (user_id, branch_id)`

### 1.6 `public.user_company_memberships` (Company Scoping)
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `user_id` (UUID, NOT NULL, FK $\rightarrow$ `public.profiles.id` ON DELETE CASCADE)
- `company_id` (TEXT, NOT NULL, FK $\rightarrow$ `public.company.id` ON DELETE CASCADE)
- `is_primary` (BOOLEAN, Default: `FALSE`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `CONSTRAINT uq_user_company UNIQUE (user_id, company_id)`

### 1.7 `public.auth_audit_events` (Security Audit Log)
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `user_id` (UUID)
- `phone` (VARCHAR(20))
- `event_type` (VARCHAR(50), NOT NULL)
- `ip_address` (VARCHAR(45))
- `user_agent` (TEXT)
- `status` (VARCHAR(20), Check: `status IN ('SUCCESS', 'FAILURE', 'ATTEMPT', 'BLOCKED')`)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ, Default: `now()`)

---

## 2. Automatic Provisioning Trigger

```sql
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

    INSERT INTO public.profiles (id, phone, full_name, display_name, email, status, is_profile_completed)
    VALUES (NEW.id, v_phone, v_name, v_name, v_email, 'ACTIVE', FALSE)
    ON CONFLICT (id) DO UPDATE SET updated_at = now(), last_activity_at = now();

    INSERT INTO public.user_role_assignments (user_id, role_id)
    VALUES (NEW.id, 'CUSTOMER')
    ON CONFLICT (user_id, role_id) DO NOTHING;

    INSERT INTO public.auth_audit_events (user_id, phone, event_type, status, metadata)
    VALUES (NEW.id, v_phone, 'USER_SIGNUP', 'SUCCESS', jsonb_build_object('source', 'auth_trigger'));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
```
