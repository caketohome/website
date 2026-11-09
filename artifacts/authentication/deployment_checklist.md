# CakeToHome — Supabase Authentication Deployment Checklist

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Gate:** Production Authentication Cutover  

---

## 1. Pre-Deployment Database Readiness

- [x] Schema migration file prepared: `backend/src/migrations/20261103_supabase_auth_and_rbac_schema.sql`
- [x] Verified against rehearsal database: 100% passed without errors.
- [x] Confirmed zero regression on protected baseline `cth_test` (orders: 127, invoices: 71, vouchers: 4).
- [ ] Production Database Execution: Apply `20261103_supabase_auth_and_rbac_schema.sql` against the live production Supabase database.

---

## 2. Supabase Console Configuration

- [ ] Project Settings $\rightarrow$ Database $\rightarrow$ Connection Pooling: Mode: Transaction, Port: 6543.
- [ ] Authentication $\rightarrow$ Providers $\rightarrow$ Phone: Toggle **Enabled**.
- [ ] Authentication $\rightarrow$ SMS Provider: Configure Twilio or Fast2SMS/MSG91 with Indian DLT credentials.
- [ ] Authentication $\rightarrow$ Rate Limits: Verify rate limits (SMS: 5/hr, verify: 5 attempts).
- [ ] Authentication $\rightarrow$ URL Configuration: Set Site URL to `https://caketohome.com` and add redirect URLs.

---

## 3. Web Service & Environment Variables

- [ ] Inject `NEXT_PUBLIC_SUPABASE_URL` into Render Frontend dashboard.
- [ ] Inject `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` into Render Frontend dashboard.
- [ ] Inject `DATABASE_URL` (Port 6543) into Render Frontend and Backend dashboards.
- [ ] Inject `JWT_SECRET` (64-character random string) into Render Frontend and Backend dashboards.
- [ ] Execute post-deployment smoke test (`/api/v1/auth/request-otp` and `/login`).
