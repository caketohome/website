# CakeToHome — Supabase Authentication & Identity Architecture

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Version:** 1.0.0  
**Status:** IMPLEMENTED & TESTED  

---

## 1. System Architecture Map

```
[ Browser / Mobile Client ]
         │
         │  1. Mobile Phone (+91 E.164) + OTP Submission
         ▼
[ Next.js 14 App Router Storefront ]
         │
         │  2. Route Handlers (/api/v1/auth/request-otp & verify-otp)
         ▼
[ Supabase Auth & JWT Verification Engine ]
         │
         │  3. Cryptographic Token Verification (HS256 via jose / HMAC)
         ▼
[ Next.js API & Services Layer ]
         │
         │  4. Authoritative Database Profile & Role Resolution
         ▼
[ PostgreSQL Database (Port 5433 / Supavisor 6543) ]
         │
         ├── auth.users (Core identity anchor, UUID)
         ├── public.profiles (Application profile linked 1:1 to auth.users.id)
         ├── public.user_role_assignments (Authoritative RBAC assignments)
         ├── public.user_branch_memberships (Branch-scoped access controls)
         └── public.auth_audit_events (Append-only audit log)
         │
         ▼
[ Row Level Security (RLS) Policies ]
         ├── Customer isolation (auth.uid() = id)
         ├── Staff branch-scoping (branch_id IN permitted_branches)
         └── Super Admin global administrative control
```

---

## 2. Core Architectural Principles

1. **Database as Source of Truth**: User identity relationships, roles, permissions, and business access are governed by PostgreSQL tables (`public.profiles`, `public.user_role_assignments`, `public.user_branch_memberships`), never by client-supplied metadata or client-editable fields.
2. **Zero Credential Duplication**: Password and authentication hashes remain strictly encapsulated within `auth.users`. Application tables store zero credentials.
3. **Fail-Closed Authorization**: In the absence of verified server claims, requests default to unauthenticated or restricted access.
4. **Idempotent Profile Provisioning**: A PostgreSQL trigger on `auth.users AFTER INSERT` guarantees that every authenticated identity automatically and idempotently receives a `public.profiles` record and default `CUSTOMER` role.
5. **Multi-Role Support**: Supports 8 canonical roles: `CUSTOMER`, `STORE_STAFF`, `STORE_MANAGER`, `OPERATIONS`, `FINANCE`, `ADMIN`, `SUPER_ADMIN`, and `DELIVERY_PARTNER`.
