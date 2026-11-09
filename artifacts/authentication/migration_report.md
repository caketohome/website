# CakeToHome — Supabase Auth & RBAC Migration Report

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Migration File:** `backend/src/migrations/20261103_supabase_auth_and_rbac_schema.sql`  
**Execution Script:** `frontend/migrate_supabase_auth_and_rbac.js`  
**Target Environment:** `cth_rehearsal_phase5_7` (PostgreSQL 16.14 on 127.0.0.1:5433)  
**Execution Date:** 2026-11-03  

---

## 1. Migration Execution Summary

The migration was applied transactionally (`BEGIN ... COMMIT`) to ensure atomicity.

| Object Created | Type | Status | Forensic Verification |
| :--- | :---: | :---: | :--- |
| `auth` | Schema | Created | Standard Supabase identity schema |
| `auth.users` | Table | Verified | Standard columns + indexes on `phone` and `email` |
| `auth.uid()` | Function | Created | Extracts UUID from `request.jwt.claim.sub` |
| `auth.role()` | Function | Created | Extracts role from `request.jwt.claim.role` |
| `auth.jwt()` | Function | Created | Extracts JSONB from `request.jwt.claims` |
| `public.roles` | Table | Created & Seeded | 8 canonical roles seeded |
| `public.permissions` | Table | Created & Seeded | 15 fine-grained capabilities seeded |
| `public.role_permissions` | Table | Created & Seeded | 30 role-permission mappings |
| `public.profiles` | Table | Created | 1:1 link to `auth.users(id)` ON DELETE CASCADE |
| `public.user_role_assignments` | Table | Created | Multi-role assignment table with unique constraint |
| `public.user_branch_memberships`| Table | Created | FK to `public.branch(id)` with unique constraint |
| `public.user_company_memberships`| Table | Created | FK to `public.company(id)` with unique constraint |
| `public.auth_audit_events` | Table | Created | Append-only security audit log |
| `public.handle_new_auth_user()` | Trigger Function | Created & Tested | Automatically provisions profile & assigns `CUSTOMER` role |
| `on_auth_user_created` | Trigger | Attached | Trigger on `auth.users AFTER INSERT` |
| Row Level Security (RLS) | Security | Enforced | Enabled on all 8 tables with 14 precise policies |

---

## 2. Invariant Data Preservation

- **Baseline Database (`cth_test`):** 100% UNTOUCHED (0 writes). Verified `order`: 127, `invoice`: 71, `accounting_voucher`: 4.
- **Disposable Database (`cth_rehearsal_phase5_7`):** All 39 existing tables preserved; zero dropped columns; zero data loss.
