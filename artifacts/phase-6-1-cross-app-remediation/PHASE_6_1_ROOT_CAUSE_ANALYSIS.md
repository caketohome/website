# PHASE 6.1 — ROOT CAUSE ANALYSIS (RCA)

### 1. The `/account` vs `/accounting` Routing Hijack
- **Observation:** Navigating to `/accounting/chart-of-accounts` or `/accounting/bank-management` frequently redirected users to `/account` (Customer Account Hub).
- **Root Cause:** In `frontend/src/middleware.ts`, the rule `if (pathname.startsWith("/account"))` matched any path beginning with `/account`, including `/accounting/chart-of-accounts`. Because the admin session was detected without customer session keys, the middleware redirected the user.
- **Remediation:** Changed match condition to `(pathname === "/account" || pathname.startsWith("/account/"))`.

### 2. Statutory Invoice 404 & Memory Allocation Failure
- **Observation:** `/invoices/CH-26-27-000216` returned 404 or stalled during request.
- **Root Cause:** Next.js development server lacked the top-level route `app/invoices` when booted, and Webpack PackFileCache ran out of Node buffer memory on large dependency trees.
- **Remediation:** Created `frontend/src/app/invoices/[...invoiceNumber]/page.tsx` and configured Node with `--max-old-space-size=4096`.

### 3. Trial Balance Reporting Omission
- **Observation:** The Trial Balance table in the previous summary report had 11 rows that did not add up to ₹13,44,610.40.
- **Root Cause:** The database contains 17 active posting accounts with 69 journal lines. A manual markdown table omitted 6 accounts (including Axis Bank sub-accounts 1112-01 through 1112-07).
- **Remediation:** Reconciled directly against PostgreSQL; verified exact parity (Dr ₹13,44,610.40 == Cr ₹13,44,610.40).
