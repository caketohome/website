# CakeToHome — Authentication Security & Secret Hygiene Audit

**Project:** CakeToHome  
**Legal Entity:** CakeToHome India Private Limited  
**Audit Standard:** OWASP Top 10 / Supabase Security Hardening  

---

## 1. Secret Hygiene Verification

| Secret Item | Location Audited | Result | Forensic Finding |
| :--- | :--- | :---: | :--- |
| Supabase `service_role` Key | Frontend Code / Bundles | **CLEAN (ZERO EXPOSURE)** | Service role key is never prefixed with `NEXT_PUBLIC_` and never included in browser assets. |
| Database Password | Repository Files | **PROTECTED** | Local files excluded via `.gitignore`; credentials managed via server-only environment variables. |
| JWT Signing Secret | Environment Configuration | **SECURE** | Tested with 64-character server secret; rejects default fallback in production mode. |
| SMS Provider Secrets | Application Architecture | **SECURE** | SMS credentials reside strictly in cloud console or server-only env vars. |

---

## 2. Vulnerability & Defense Assessment

| Vulnerability Vector | Defense Mechanism | Test Status |
| :--- | :--- | :---: |
| **Privilege Escalation** | Roles loaded exclusively from `public.user_role_assignments` using verified `auth.users.id`. Any role specified in client requests or JWT payloads is completely ignored. | **VERIFIED / PASS** |
| **JWT Tampering** | Cryptographic HMAC SHA-256 verification via `jose` and timing-safe equality checks. Modified signatures or payloads fail verification. | **VERIFIED / PASS** |
| **Replay / Expiration** | Enforces `exp` claim checks against unix timestamp; expired tokens are rejected immediately. | **VERIFIED / PASS** |
| **Cross-Tenant / Branch Access** | Store staff and managers can only read and mutate records scoped to their assigned `branch_id` in `public.user_branch_memberships`. | **VERIFIED / PASS** |
| **IDOR / Customer Isolation** | Customer profile and order access requires matching `auth.uid() = id` or `customer_phone = profile.phone`. | **VERIFIED / PASS** |
| **Brute Force OTP Guessing** | 30-second client rate limiter + 5-attempt server threshold + automatic invalidation after 5 minutes. | **VERIFIED / PASS** |
