# CakeToHome — Supabase Auth Configuration Report

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Target Architecture:** Supabase Managed Auth (GoTrue) + PostgreSQL  

---

## 1. Project Reference & Environment Inspection

- **Configured Development Supabase Project Ref:** `uubwhsnnrnicyczwqlbq`
- **Configured Supabase URL in `.env`:** `https://xfvgumatwucammmbwdwv.supabase.co`
- **Configured Database Pooler:** `aws-1-ap-south-1.pooler.supabase.com:6543` (`postgres.uubwhsnnrnicyczwqlbq`)
- **DNS Probing Ground Truth:**
  - `aws-1-ap-south-1.pooler.supabase.com` resolves to `13.200.110.68` (Active AWS Mumbai pooler).
  - `uubwhsnnrnicyczwqlbq.supabase.co` $\rightarrow$ `ENOTFOUND` (Tenant paused or moved).
  - `xfvgumatwucammmbwdwv.supabase.co` $\rightarrow$ `ENOTFOUND` (Tenant paused or invalid).
- **Zealosh LMS Isolation:** Confirmed zero references to `zealosh` in repository codebase.
- **Local Rehearsal Database:** PostgreSQL 16.14 on `127.0.0.1:5433` (`cth_rehearsal_phase5_7`), fully initialized with `auth` schema and RLS policies.

---

## 2. Supabase Auth Settings Required in Production Console

When deploying to the live production Supabase instance, the following settings must be verified in the Supabase Dashboard:

1. **Authentication $\rightarrow$ Providers $\rightarrow$ Phone**:
   - Status: **Enabled**
   - SMS Provider: **Twilio / Fast2SMS / MSG91** (See [OTP Provider Setup Guide](file:///e:/vig/cakes2home-main/cakes2home-main/artifacts/authentication/otp_provider_setup_guide.md))
   - OTP Expiry: **300 seconds (5 minutes)**
   - SMS Template: `Your CakeToHome verification code is: {{ .Code }}. Valid for 5 minutes. Do not share.`
2. **Authentication $\rightarrow$ Providers $\rightarrow$ Email**:
   - Status: **Enabled** (for administrative and transactional notifications)
   - Confirm Email: Optional based on business policy.
3. **Authentication $\rightarrow$ URL Configuration**:
   - Site URL: `https://caketohome.com`
   - Redirect URLs:
     - `https://caketohome.com/**`
     - `https://caketohome.com/login`
     - `https://caketohome.com/account`
     - `https://caketohome.com/dashboard`
4. **Authentication $\rightarrow$ Rate Limits**:
   - SMS: Max 5 requests per hour per phone number.
   - Verify: Max 5 failed attempts per OTP before invalidation.
