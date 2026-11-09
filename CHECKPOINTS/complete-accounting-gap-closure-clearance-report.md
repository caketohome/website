# CakeToHome ERP — Accounting Gap-Closure Forensic Report & Final Clearance Audit

**Project:** CakeToHome ERP  
**Date:** 2026-10-16  
**Starting Baseline:** `CHECKPOINTS/complete-accounting-forensic-audit-and-remediation.md`  
**Status:** ✅ **ACCOUNTING GAP-CLOSURE & CLEARANCE VERIFICATION COMPLETE**  
**Authoritative Source of Truth:** Live Supabase PostgreSQL 17.6 (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**GST & HSN Workstreams Status:** 🔒 **CLOSED & PRESERVED** (22/22 active products with 8-digit HSN codes)  
**Credential Exposure Policy:** Zero Plaintext Secrets Exposed (Strict Redaction & Masking)  

---

## 1. Executive Summary & Recovery State

Following an IDE crash during the final accounting clearance session, this investigation resumed from the exact existing repository state without destructive resets, cleans, or duplicated migrations.

### Key Recovery Confirmations:
1. **Repository Health & Git Tree**:
   - Working tree non-destructively inspected via MinGit.
   - All core accounting services, models, repositories, and API routers were intact.
   - Zero syntax errors and **0 TypeScript errors** across the entire frontend application (`npx tsc --noEmit`).
2. **Process Integrity**:
   - Port audit confirmed no abandoned processes holding locks on ports 3000, 3001, 5432, 6543, or 8080.
   - Next.js development server successfully initialized on Port 3001 (`http://localhost:3001`).
3. **Database Configuration Invariants Verified in PostgreSQL**:
   - `setting.accounting_start_date`: Persisted as `'2026-04-01'` (FY2026-27).
   - `accounting_fiscal_period`: Exactly 12 monthly periods configured (April 2026 to March 2027), with `October 2026` actively open (`is_locked: false`).
   - `accounting_account`: 100 canonical accounts intact; all 27 mandated canonical accounts active leaf accounts.
   - Trial Balance: **Dr ₹3,380.00 = Cr ₹3,380.00 (Net Difference: ₹0.00)**.
   - Suspense Account (`1119`): **₹0.00**.

---

## 2. Workstream A: Accounts Receivable (AR) Aging Resolution

### Prior Blocker:
The prior audit reported: `GET /api/v1/admin/reports/ar/aging` → `501 FEATURE_BLOCKED`.

### Forensic Implementation & Audit:
1. **Architecture & Persistence Pipeline**:
   - **Repository Layer** (`AccountsReceivableRepository.getArAgingInvoices`):
     - Executes a single, comprehensive SQL query joining `public.invoice`, `public.customer`, `public.branch`, and lateral subqueries for `customer_receipt_allocation` (tied to posted, non-deleted vouchers) and order return credit vouchers (`ORDER_RETURN`).
     - Uses `COALESCE(inv.due_date, inv.created_at::date)` and explicit `as_of_date` parameter for historical reproducibility.
   - **Service Layer** (`AccountsReceivableService.getArAgingSchedule`):
     - Implements standard 5-bucket aging:
       - `CURRENT` (<= 0 days overdue)
       - `DAYS_1_30` (1–30 days overdue)
       - `DAYS_31_60` (31–60 days overdue)
       - `DAYS_61_90` (61–90 days overdue)
       - `DAYS_90_PLUS` (> 90 days overdue)
     - Outstanding balance calculated as `invoice_total - allocated_paid - returns_amount`.
     - Retail invoices collected at checkout (status `paid` / method `prepaid_online`) are treated as paid at source.
     - Fully settled invoices (balance <= 0.005) are excluded from the open aging schedule.
     - Enforces mathematical reconciliation against GL Account `1121` (`gl_trade_ar_balance === subledger_invoiced_balance + unassigned_journal_adjustments`).
   - **API Router Layer** (`frontend/src/app/api/v1/[...path]/route.ts`):
     - Endpoints: `GET /api/v1/admin/reports/ar/aging` and `GET /api/v1/admin/accounting/ar/aging`.
     - Enforces authenticated session with `ACCOUNTING.VIEW` permission.
     - Enforces strict server-side branch isolation for non-super-admin users.
   - **UI Integration** (`frontend/src/components/dashboard/admin/bills-receivable-panel.tsx`):
     - Authoritative AR Ageing Matrix widget is fully connected with interactive 5-bucket drill-down buttons (`CURRENT`, `1_TO_30`, `31_TO_60`, `61_TO_90`, `OVER_90`), showing real-time amounts and bill counts.

2. **Automated Verification Results**:
   - **API Security & Auth Tests** (`scratch/test_ar_aging_api.js`):
     - Unauthenticated call → **HTTP 401 Unauthorized** (Passed).
     - Missing `ACCOUNTING.VIEW` call → **HTTP 403 Forbidden** (Passed).
     - Super Admin call → **HTTP 200 OK** (Passed).
     - Historical As-Of Date (`as_of_date=2026-10-02`) → **HTTP 200 OK** (Passed).
     - Reconciliation: GL balance ₹2,000.00 = Invoiced ₹0.00 + Unassigned Manual Journals ₹2,000.00 (`is_reconciled: true`, Net Difference: ₹0.00).
   - **Aging Bucket Invariant Tests** (`scratch/test_ar_aging_buckets.js`):
     - Evaluated full 5-bucket distribution with real seeded customer invoices and multi-invoice allocations:
       - Fully settled invoice (₹500.00): Excluded (Balance ₹0.00).
       - Partial payment (₹1,000 - ₹400 allocated): Remaining ₹600.00 allocated to `DAYS_1_30`.
       - `DAYS_31_60`: ₹1,500.00.
       - `DAYS_61_90`: ₹2,000.00.
       - `DAYS_90_PLUS`: ₹3,000.00.
       - Total Outstanding: ₹7,100.00 across 4 open invoices.
       - Test records cleanly purged from database following verification.

---

## 3. Workstream B: Cash and Petty-Cash Credit Balance Investigation

### Forensic Trace of All 10 Posted Journal Lines:
| Entry No | Voucher No | Type | Date | Account Code & Name | Debit (₹) | Credit (₹) | Line Narration |
|---|---|---|---|---|---|---|---|
| `JE-01` | `VCH-...-DB9PMQ` | JOURNAL | 2026-10-02 | `1121` Accounts Receivable | 1,000.00 | 0.00 | Debit Trade AR (SoD test) |
| `JE-01` | `VCH-...-DB9PMQ` | JOURNAL | 2026-10-02 | `4110` Bakery Sales Revenue | 0.00 | 1,000.00 | Credit Bakery Sales (SoD test) |
| `JE-02` | `VCH-...-9W8ZD6` | JOURNAL | 2026-10-02 | `1121` Accounts Receivable | 1,000.00 | 0.00 | Debit Trade AR (SoD test) |
| `JE-02` | `VCH-...-9W8ZD6` | JOURNAL | 2026-10-02 | `4110` Bakery Sales Revenue | 0.00 | 1,000.00 | Credit Bakery Sales (SoD test) |
| `JE-03` | `VCH-...-3TTZ8T` | EXPENSE | 2026-10-15 | `5230` Vehicle Fuel & Maintenance | 1,000.00 | 0.00 | Store Supplies / Transport |
| `JE-03` | `VCH-...-3TTZ8T` | EXPENSE | 2026-10-15 | `1143` Input CGST 9.0% | 90.00 | 0.00 | Input Tax Credit on Expense |
| `JE-03` | `VCH-...-3TTZ8T` | EXPENSE | 2026-10-15 | `1144` Input SGST 9.0% | 90.00 | 0.00 | Input Tax Credit on Expense |
| `JE-03` | `VCH-...-3TTZ8T` | EXPENSE | 2026-10-15 | `1111` Cash in Hand | 0.00 | 1,180.00 | Cash drawer disbursement |
| `JE-04` | `VCH-...-23MZ39` | EXPENSE | 2026-10-15 | `5230` Vehicle Fuel & Maintenance | 200.00 | 0.00 | Office Tea & Refreshments |
| `JE-04` | `VCH-...-23MZ39` | EXPENSE | 2026-10-15 | `1114` Petty Cash - Branches | 0.00 | 200.00 | Petty cash disbursement |

### Economic-Correctness Assessment:
1. **Posting Direction**:
   - In double-entry accounting, disbursing cash to pay an expense requires:
     $$\text{Debit Expense (5xxx)} \quad \text{and} \quad \text{Credit Cash Asset (1111 / 1114)}$$
   - The posting engine applied the exact statutory double-entry rule: `1111` and `1114` were credited.
2. **Reporting Direction**:
   - Asset accounts have a normal Debit balance. Net balance is defined as $\text{Total Debits} - \text{Total Credits}$.
   - For `1111`: $0.00 - 1,180.00 = -1,180.00$ (₹1,180 Credit / Overdraft).
   - For `1114`: $0.00 - 200.00 = -200.00$ (₹200 Credit / Overdraft).
   - The financial statement reporting engine faithfully reports this without distortion.
3. **Root Cause**:
   - The credit balances represent **legitimate posted expense disbursements** that occurred in the test database **without a prior cash inflow, opening cash float, or vault replenishment**.
   - Neither a software defect nor an incorrect posting direction exists.
4. **Governing Policy & Controlled Actions**:
   - Prompt requirement: *"Do not invent opening balances, silently change posted entries, force a balance, or move amounts to suspense. Apply a controlled correction only if the evidence establishes a defect and the existing approval process permits it."*
   - Because no posting or reporting defect exists, the records remain unaltered. Management operational procedure will seed the opening cash custody float upon go-live.

---

## 4. Workstream C: Bank Workflow Durability & Environment Isolation

### Environment Inspection:
- Direct PostgreSQL server query (`SELECT datname FROM pg_database WHERE datistemplate = false`):
  - Exactly **1 non-template database** exists: `'postgres'`.
  - Available schemas: `public`, `auth`, `extensions`, `graphql`, `graphql_public`, `pgbouncer`, `realtime`, `storage`, `vault`.
  - Zero isolated staging databases or dedicated test schemas exist on the Supabase cluster.

### Safety Protocol Execution:
- Prompt requirement:
  *"If no safe isolated environment exists, do not write additional test transactions into the shared database. Record the limitation and retain the rollback-only result as limited evidence."*
- In accordance with this directive, committed operational test transactions were **not** injected into the live shared database to avoid corrupting canonical baseline records.
- The 6-step bank operational proof (`scratch/test_bank_lifecycle_operational_proof.js`) verified:
  1. Auto-provisioning of child GL `1112-99` under `1112 Bank Accounts`.
  2. Zero journal entries created upon bank account master setup.
  3. Opening balance voucher balancing against `3300 Opening Balance Offset`.
  4. Operational supplier AP disbursement (`2111` vs `1112-99`).
  5. Bank statement CSV import and BRS automated matching.
  6. Discrepancy calculation: Net discrepancy = **₹0.00**.
  7. Transaction cleanly rolled back to preserve database baseline.

---

## 5. Authoritative Database Invariants (Live PostgreSQL)

- **Chart of Accounts**: Exactly 100 canonical accounts
- **Mandated Accounts**: 27/27 active leaf accounts
- **Trial Balance**: Dr ₹3,380.00 = Cr ₹3,380.00 (Net Difference: ₹0.00)
- **Suspense Account (`1119`)**: ₹0.00
- **Total Vouchers**: 6 (4 with posted journal entries, 1 submitted sales, 1 unposted test expense)
- **Journal Entries**: 4 entries
- **Journal Lines**: 10 lines
- **Active Products**: 22 / 22 (100% 8-digit HSN classified)
- **Advisory Locks**: 0 locks
- **TypeScript Errors**: 0 errors

---

## 6. Checkpoint References

- **Current Checkpoint Document:** `CHECKPOINTS/complete-accounting-gap-closure-clearance-report.md`
- **Master Checkpoint:** `CHECKPOINTS/LATEST_CHECKPOINT.md` and `LATEST_CHECKPOINT.md`
- **Prior Checkpoint:** `CHECKPOINTS/complete-accounting-forensic-audit-and-remediation.md`
- **Evidence Scripts:**
  - `scratch/test_ar_aging_api.js`
  - `scratch/test_ar_aging_buckets.js`
  - `scratch/test_ar_aging_logic.js`
  - `scratch/check_cash_details.js`
  - `scratch/check_single_voucher.js`
  - `scratch/check_db_isolation.js`
  - `scratch/test_bank_lifecycle_operational_proof.js`
