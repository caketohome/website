# CakeToHome Phase 4.3 — Deployment Safety and Environment Isolation

## 1. Environment Topology & Boundary Controls

| Tier | Database Endpoint | Authentication | Mode | Write Policy |
|---|---|---|---|---|
| Protected Baseline | `127.0.0.1:5433/cth_test` | `cth_test_user` | READ-ONLY | **ZERO WRITES PERMITTED**. Cryptographically fingerprinted before and after all phase activities. |
| Verification Sandbox | `127.0.0.1:5433/cth_disposable_phase4_3` | `cth_test_user` | READ-WRITE | Isolated disposable test database cloned from `cth_test`. Destroyed and recreated per test phase. |
| Production Target | Remote AWS/Supabase Pooler | Dedicated Service Role | GATED | Fail-closed pending corporate CA board resolution. |

## 2. CI/CD Release Safeguards (`lint_migrations.cjs`)
A pre-deployment static analysis linter (`frontend/scripts/lint_migrations.cjs`) was added to the repository.
- Scans every `.sql` file in `frontend/src/lib/migrations/`.
- Inspects active DML statements for forbidden approver literals (`ca_audit_signed`, `partner_audit_signed`, `system_audit`, `admin_qa_super`, `synthetic_ca`).
- Detects unconditional `SET approval_status = 'APPROVED'` outside of explicit authorized APIs.
- Automatically fails CI builds with exit code 1 if any un-remediated synthetic approval logic is present.

## 3. Database Credential Isolation
- Application runtime services connect with least-privilege configurations.
- Schema migrations (`c7_12`, `c7_13`) use separate deployment automation scripts.
- The runtime database role is barred from mutating the append-only `public.invoice_series_approval_audit` table.

