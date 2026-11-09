# CAKETOHOME — MIGRATION REGISTER
## Database Migration Inventory & Baseline Integrity

### 1. Executed Migrations
1. `20261103_supabase_auth_and_rbac_schema.sql`: Established `auth.users`, `public.profiles`, `public.roles`, `public.user_role_assignments`, and RLS policies.
2. `20261103_payment_verification_and_sync.sql`: Created `public.payment_webhook_event`, `public.customer_notification_queue`, and atomic payment verification procedures.
3. `allocate_invoice_number` stored procedure: Hardened with advisory locks, FY 2026-2027 calendar resolution, and series prefix enforcement.

### 2. Environment Protection
- Protected baseline `cth_test` remained 100% untouched.
- All migrations and modifications applied strictly within disposable rehearsal environments (`cth_rehearsal_phase5_7` and `cth_rehearsal_phase4`).
