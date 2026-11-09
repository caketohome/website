# Phase 4.4 Remediation Change Log

1. **SQL Migration `c7_14`**: Created `frontend/src/lib/migrations/c7_14_database_trigger_and_truncate_governance.sql`.
   - Upgrades governance trigger to `BEFORE INSERT OR UPDATE`.
   - Adds statement-level trigger blocking `TRUNCATE` on audit table.
   - Marks triggers `ENABLE ALWAYS`.
2. **CI Linter Hardening**: Updated `frontend/scripts/lint_migrations.cjs`.
   - Implements zero-dependency lexical comment stripping (`/* ... */`, `--`).
   - Normalizes whitespace and unquotes identifiers.
   - Detects dynamic SQL (`EXECUTE`, `format(`) and direct INSERT promotions.
3. **API Authorization Hardening**: Updated `frontend/src/app/api/v1/[...path]/route.ts`.
   - Explicitly rejects `userId === "anonymous"` or empty identity strings.