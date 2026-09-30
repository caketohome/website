# Pre-Remediation Baseline Checkpoint: CakeToHome

**Checkpoint ID**: `CHECKPOINTS/security-remediation-start-01.md`  
**Timestamp**: 2026-09-20 11:12:00 IST  
**Audit Reference**: `E:\vig\security-audit-runs\cakes2home-main\run-1\`  
**Preceding Checkpoint**: `CHECKPOINTS/order-confirmation-react-child-fix-01.md` (2026-09-19 20:25:00 IST)  
**Status**: `REMEDIATION INITIATION — ZERO SOURCE CHANGES MADE YET`

---

## 1. Context & Working Tree Baseline
- **Application Target**: `e:\vig\cakes2home-main\cakes2home-main`
- **Frontend Active**: Next.js 14.1.4 (Port 3000 actively running)
- **Database Architecture**: PostgreSQL (direct pool via `frontend/src/lib/db.ts`) with Supabase pooler fallback
- **Recent Stable Work**:
  - Cleaned up React child object rendering on `/your-order` and `/checkout`
  - All 53 browser acceptance assertions passed (`CHECKPOINTS/final-browser-ui-acceptance-01.md`)
  - No database resets, table drops, or truncation performed

---

## 2. The Seven Confirmed Audit Findings

| ID | Finding Title | Severity | Target File & Function |
|---|---|---|---|
| **Finding 1** | Administrative Authentication Bypass | **CRITICAL** | `frontend/src/app/api/v1/[...path]/route.ts` (`verifyApiPermission`) |
| **Finding 2** | Privilege Escalation / Role Spoofing via Headers | **CRITICAL** | `frontend/src/app/api/v1/[...path]/route.ts` (`resolveUserContext`) |
| **Finding 3** | Super-Admin Escalation via Substring Match | **HIGH** | `frontend/src/lib/staff-access-control.ts` (`hasPermission`) |
| **Finding 4** | Customer Orders BOLA / IDOR via `x-phone` | **HIGH** | `frontend/src/app/api/customer/orders/route.ts` (`GET`) |
| **Finding 5** | Customer Profile BOLA / IDOR via `x-phone` | **HIGH** | `frontend/src/app/api/customer/profile/route.ts` (`GET`, `PUT`) |
| **Finding 6** | Plaintext Supabase Database Credentials in Source | **HIGH** | `frontend/src/lib/db.ts` (`connectionString`) |
| **Finding 7** | Outbound Webhook SSRF | **HIGH** | `frontend/src/lib/webhook-engine.ts` (`createEndpoint`, `fetch(ep.url)`) |

---

## 3. Known Application Authentication & Session Flows

1. **Customer Mobile OTP Login**:
   - Customer submits phone number -> OTP generated/verified -> session cookie `_cth_jwt` / `_medusa_jwt` set.
   - Profile & Orders APIs currently have insecure fallbacks trusting `x-phone`, `x-customer-uid`, `_cth_phone`, `_cth_user_id`.
2. **Staff & Admin Login**:
   - Staff members authenticate via `/login` -> session JWT `_cth_jwt` set with role & user ID.
   - Next.js Edge Middleware (`middleware.ts`) checks `_cth_role` cookie for page navigation protection.
   - API multiplexer currently trusts `x-user-role`, `_cth_role`, `x-user-id` without cryptographically verifying `_cth_jwt`.
3. **Staff RBAC Engine (`StaffAccessControl`)**:
   - Maps staff accounts to access profiles and module-level action permissions.
   - Loose condition `userId.includes("admin")` accidentally grants super-admin privileges to non-admins.

---

## 4. Planned Remediation Sequence

1. **Phase 2 — Map Existing Authentication Architecture**:
   Deeply inspect how tokens are created and verified in `frontend` and `backend`.
2. **Phase 3 — Fix Admin API Auth Bypass (Finding 1)**:
   Make `verifyApiPermission` strictly fail-closed (return 401 for unauthenticated requests, 403 for unauthorized, while preserving public endpoints).
3. **Phase 4 — Eliminate Client-Controlled Staff Identity (Finding 2)**:
   Extract user identity and role strictly from verified JWT tokens / server session, ignoring forged `x-user-role` / `x-user-id` headers.
4. **Phase 5 — Eliminate Substring Admin Escalation (Finding 3)**:
   Remove `userId.includes("admin")` and enforce exact canonical role and ID matching.
5. **Phase 6 — Fix Customer BOLA / IDOR (Findings 4 & 5)**:
   Enforce authenticated customer session resolution; eliminate unverified `x-phone` and `x-customer-uid` lookups.
6. **Phase 7 — Secure Database Credentials (Finding 6)**:
   Remove hardcoded database credentials from `db.ts`, rely strictly on `process.env.DATABASE_URL`, fail safely if missing. Document rotation requirements.
7. **Phase 8 — Implement Webhook SSRF Protections (Finding 7)**:
   Add URL scheme, hostname, and private/loopback/cloud-metadata IP blocking in `webhook-engine.ts`.
8. **Phase 9 — Secrets Scan**:
   Scan repository for exposed secrets without printing them.
9. **Phase 10-13 — Automated Security & Application Regression Testing**:
   Create and execute test suites covering all findings and verifying zero regressions.
10. **Phase 15-16 — Final Reports & Checkpoints**:
   Create `CHECKPOINTS/security-remediation-final-report.md` and `CHECKPOINTS/security-remediation-final-01.md`.
