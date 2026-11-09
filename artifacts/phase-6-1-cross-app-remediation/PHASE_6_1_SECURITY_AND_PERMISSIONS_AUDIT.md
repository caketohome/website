# PHASE 6.1 — SECURITY AND PERMISSIONS AUDIT

- **RBAC Enforcement:** Route guards active for `SUPER_ADMIN`, `BRANCH_MANAGER`, and `FINANCE`.
- **Fail-Closed Protection:** `frontend/src/lib/db.ts` strictly forbids accidental connection to remote Supabase endpoints in non-production runs.
- **Statutory Privacy:** Bank account numbers masked in UI (`account_number_masked`).
