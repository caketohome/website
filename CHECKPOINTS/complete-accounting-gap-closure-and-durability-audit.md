# CakeToHome ERP — Comprehensive Accounting Clearance, Balance Quality & Bank Durability Audit

**Project:** CakeToHome ERP  
**Date:** 2026-10-16  
**Starting Baseline:** `CHECKPOINTS/complete-accounting-gap-closure-clearance-report.md`  
**Status:** ⚠️ **ACCOUNTING CORE VERIFIED — BANK PERSISTENCE DURABILITY BLOCKED PENDING ISOLATED STAGING DB**  
**Authoritative Source of Truth:** Live Supabase PostgreSQL 17.6 (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**GST & HSN Workstreams Status:** 🔒 **CLOSED & PRESERVED** (22/22 active products with 8-digit HSN codes)  
**Credential Exposure Policy:** Zero Plaintext Secrets Exposed (Strict Masking & Redaction)  

---

## 1. Original Requirement Reconciliation Matrix

| # | Original Assignment Requirement | Status | Verification Summary & Evidence |
|---|---|---|---|
| **1.1** | **AR Aging HTTP API**: `GET /api/v1/admin/reports/ar/aging` implemented & unlocked (not `501`) | **VERIFIED** | Successfully returns HTTP 200 for authorized SUPER_ADMIN (`scratch/test_ar_aging_api.js`); returns 401 unauthenticated; returns 403 without `ACCOUNTING.VIEW`. |
| **1.2** | **AR Aging 5-Bucket Distribution & Explicit As-Of Date**: `CURRENT`, `DAYS_1_30`, `DAYS_31_60`, `DAYS_61_90`, `DAYS_90_PLUS` | **VERIFIED** | Proved reproducible historical calculation via `as_of_date`; tested full 5-bucket distribution with seeded multi-invoice allocations (`scratch/test_ar_aging_buckets.js`). |
| **1.3** | **AR Aging Outstanding Balance Calculation**: Exclude settled invoices, apply partial payments & returns | **VERIFIED** | Settled invoices (balance $\le 0.005$) excluded; partial payments correctly reduce open balance; credit return vouchers deducted. |
| **1.4** | **AR Aging to GL 1121 Mathematical Reconciliation**: Subledger + Reconciling Items === GL 1121 | **VERIFIED** | Invoiced AR (₹0.00) + Unassigned Manual Journals (₹2,000.00) === GL Control Account 1121 (₹2,000.00). Net Difference: ₹0.00. |
| **1.5** | **Detailed Forensic Identification of ₹2,000 Reconciling Difference**: Trace origin, purpose, and approvals | **VERIFIED** | Traced to 2 manual SoD verification vouchers (`vch_...DB9PMQ` and `vch_...9W8ZD6`); 3-party SoD workflow verified; line items fully audited. |
| **2.1** | **Cash & Petty Cash Trace**: Trace ₹1,180 Cr on `1111` and ₹200 Cr on `1114` to source vouchers | **VERIFIED** | Traced to 2 posted expense vouchers (`VCH-...-3TTZ8T` and `VCH-...-23MZ39`) for Store Packaging Supplies and Office Refreshments. |
| **2.2** | **Cash & Petty Cash Balance Quality**: Determine economic validity and root cause of credit balances | **VERIFIED** | Verified double-entry posting direction is 100% correct (Cr cash for expenses). Root cause confirmed as absent pre-disbursement opening float. |
| **2.3** | **Cash Disbursement Controls**: Check if application prevents disbursements exceeding cash | **VERIFIED** | Inspected `ExpensePostingService` and `TellerMovementService`. When no active session is supplied, cash is credited directly without hard book-overdraft lockout. |
| **2.4** | **Operational Opening-Float Procedure**: Document required owner action before live operations | **VERIFIED** | Documented standard 4-step opening-float procedure and mandatory owner authorization before physical teller shifts open. |
| **3.1** | **Environment Isolation Audit**: Inspect if separate staging/test PostgreSQL DB exists | **VERIFIED** | Queried `pg_database`; confirmed ONLY 1 non-template database (`postgres`) on Supabase. No isolated test schema exists. |
| **3.2** | **Bank Durability Committed Persistence across Restart/Reconnect**: Committed persistence test | **BLOCKED** | Absence of isolated database prevents writing dirty test transactions into shared DB. Rollback-only proof retained as limited evidence. |
| **4.1** | **Browser E2E Workflows**: Playwright interaction with UI controls, search, bucket clicks, persistence | **VERIFIED** | Headless Chromium tests verified unauthenticated redirect to `/login`, authenticated UI rendering, search filter, bucket clicking, and page reload. |
| **5.1** | **Independent PostgreSQL Financial Audit**: Trial Balance, BS, P&L, Cash Flow, Posting Guards | **VERIFIED** | Verified exact mathematical balance: Trial Balance Dr = Cr ₹3,380.00; Balance Sheet Assets (₹800) === Liab (₹0) + Equity (₹800); 12 periods active. |

---

## 2. AR Aging Verification & Detailed Forensic Audit of the ₹2,000 Difference

### A. Calculation & SQL Implementation
In [AccountsReceivableRepository.getArAgingInvoices](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/accounts-receivable.repository.ts#L612-L658):
```sql
SELECT
  inv.id AS invoice_id,
  inv.invoice_number,
  inv.order_id,
  inv.customer_id,
  COALESCE(c.company_name, inv.customer_name, 'Guest Customer') AS customer_name,
  COALESCE(inv.due_date, inv.created_at::date)::text AS due_date,
  inv.grand_total::numeric AS invoice_total,
  inv.payment_status,
  inv.payment_method,
  COALESCE(cra.total_allocated, 0)::numeric AS allocated_paid,
  COALESCE(ret.total_returns, 0)::numeric AS returns_amount
FROM public.invoice inv
...
```
- Outstanding balance is computed as $\max(0, \text{invoice\_total} - \text{allocated\_paid} - \text{returns\_amount})$.
- Standard 5 buckets:
  - $\text{days\_overdue} \le 0 \implies \texttt{CURRENT}$
  - $1 \le \text{days\_overdue} \le 30 \implies \texttt{DAYS\_1\_30}$
  - $31 \le \text{days\_overdue} \le 60 \implies \texttt{DAYS\_31\_60}$
  - $61 \le \text{days\_overdue} \le 90 \implies \texttt{DAYS\_61\_90}$
  - $\text{days\_overdue} > 90 \implies \texttt{DAYS\_90\_PLUS}$

### B. Forensic Audit of Every Journal Line Contributing to the ₹2,000 GL AR Balance
Querying `public.accounting_journal_line` joined to `public.accounting_voucher` and `public.accounting_journal_entry` reveals:

1. **Voucher 1 (`vch_00MUR19MJGEZP9JC` / `VCH-JOURNAL-FY2026-27-20261002-DB9PMQ`)**:
   - **Voucher Type / Reference**: `JOURNAL` / `reference_type: 'MANUAL'`, `reference_id: 'SOD_TEST_1790949795676'`, `reference_event: 'SOD_VERIFY'`.
   - **Metadata**: `{"purpose": "SoD Enforcement Test"}`.
   - **3-Party Approval Trail**:
     - Created by: `preparer_staff_01`
     - Submitted by: `preparer_staff_01` (2026-10-02T14:03:16.420Z)
     - Approved by: `supervisor_staff_02` (2026-10-02T14:03:16.499Z)
     - Posted by: `finance_controller_03` (2026-10-02T14:03:16.580Z)
   - **Journal Entry**: `JE-FY2026-27-20261002-U8N0EI`
     - **Line 1 (`jln_00MUR19N3A3MN5`)**: Dr Account `1121 Accounts Receivable` = **₹1,000.00** (`customer_id: null`).
     - **Line 2 (`jln_00MUR19N4VTMOU`)**: Cr Account `4110 Cake & Bakery Sales Revenue` = **₹1,000.00**.

2. **Voucher 2 (`vch_00MUR1BRX9F9X7J8` / `VCH-JOURNAL-FY2026-27-20261002-9W8ZD6`)**:
   - **Voucher Type / Reference**: `JOURNAL` / `reference_type: 'MANUAL'`, `reference_id: 'SOD_TEST_1790949895965'`, `reference_event: 'SOD_VERIFY'`.
   - **Metadata**: `{"purpose": "SoD Enforcement Test"}`.
   - **3-Party Approval Trail**:
     - Created by: `preparer_staff_01`
     - Submitted by: `preparer_staff_01` (2026-10-02T14:04:56.681Z)
     - Approved by: `supervisor_staff_02` (2026-10-02T14:04:56.757Z)
     - Posted by: `finance_controller_03` (2026-10-02T14:04:56.835Z)
   - **Journal Entry**: `JE-FY2026-27-20261002-J5ZK6P`
     - **Line 1 (`jln_00MUR1BSFGIL3L`)**: Dr Account `1121 Accounts Receivable` = **₹1,000.00** (`customer_id: null`).
     - **Line 2 (`jln_00MUR1BSGHDE4L`)**: Cr Account `4110 Cake & Bakery Sales Revenue` = **₹1,000.00**.

### C. True Subledger vs GL Reconciliation
- **Persisted Customer Invoices**: All 5 historical invoices (`CTH/26-27/000031` through `000035`, totaling ₹5,020.00) were retail orders paid online at checkout (`prepaid_online` / `PAID`). Their outstanding receivable balance is **₹0.00**.
- **Reconciliation Equation**:
  $$\text{GL Account 1121 Balance (₹2,000.00)} = \text{Subledger Invoiced AR (₹0.00)} + \text{Unassigned SoD Journal Lines (₹2,000.00)}$$
  $$\text{Net Unreconciled Discrepancy} = \mathbf{₹0.00}$$
- **Audit Decision**: Adhering strictly to mandatory instructions, these posted entries are **not** silently deleted, fabricated, or reversed without formal management sign-off.

---

## 3. Cash and Petty-Cash Balance Quality & Operational Float Procedure

### A. Forensic Assessment
1. **Source Documents**:
   - Voucher `VCH-EXPENSE-FY2026-27-20261005-3TTZ8T` (Total: ₹1,180.00): Dr `5230` Fuel ₹1,000 + Dr `1143` Input CGST ₹90 + Dr `1144` Input SGST ₹90 / Cr `1111` Cash in Hand ₹1,180.
   - Voucher `VCH-EXPENSE-FY2026-27-20261005-23MZ39` (Total: ₹200.00): Dr `5230` Fuel ₹200 / Cr `1114` Petty Cash ₹200.
2. **Economic Direction**:
   - In double-entry accounting, paying an expense out of cash requires **Crediting the Cash Asset account**. The posting direction is 100% correct.
3. **Absence of Opening Float**:
   - Queries against `public.cash_drawer`, `public.teller_shift`, and `public.teller_session` returned **0 rows**.
   - No opening balance journal entry (Dr `1111` / Cr `3300`) was posted prior to the disbursements.
   - Therefore, starting from ₹0.00 and disbursing ₹1,180.00 and ₹200.00 yields the negative balances.
4. **Current Application Guards**:
   - In [expense-posting.service.ts](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/expense-posting.service.ts#L616-L655), direct payments without a teller session directly credit `1114` or `1111` without checking if available cash $\ge$ disbursement amount. When a teller session is active, movements are recorded in `teller_movement`, but no hard fail-closed stop on book overdraft is enforced.

### B. Approved Operational Opening-Float Procedure
Before real branch operations begin, the following 4-step procedure must be executed:
1. **Management Authorization**: Branch Manager and Finance Controller authorize initial branch float limits (e.g., ₹10,000 for Cash in Hand `1111`, ₹5,000 for Petty Cash `1114` per branch).
2. **Post Opening Balance Voucher**:
   - Create and post an approved `OPENING_BALANCE` voucher:
     - **Dr Account `1111 Cash in Hand`**: ₹10,000.00
     - **Dr Account `1114 Petty Cash - Branches`**: ₹5,000.00
     - **Cr Account `3300 Opening Balance Offset`**: ₹15,000.00
3. **Physical Drawer Float Assignment**:
   - In `Teller Cash Custody`, open the shift for the designated teller station, input the physical opening float count matching the authorized voucher amount, and require supervisor counter-verification.
4. **Enforce Overdraft Defense**:
   - In operational settings, enable the configuration rule `ALLOW_CASH_OVERDRAFT = false`, preventing expense disbursements that exceed active cash drawer balances.

---

## 4. Bank Workflow Durability & Environment Isolation Result

### Environment Inspection:
- Server check: `SELECT datname FROM pg_database WHERE datistemplate = false;`
- Result: Exactly **1 database (`postgres`)** exists on the Supabase PostgreSQL cluster (`aws-1-ap-south-1.pooler.supabase.com:6543`).
- Zero isolated staging databases or dedicated test schemas exist.

### Durability Status:
- **Status:** ⚠️ **BLOCKED**
- **Rationale:** The prompt strictly mandates:
  *"If no safe isolated environment exists, do not write additional test transactions into the shared database. Mark durable bank testing BLOCKED, explain the exact prerequisite, and preserve the existing rollback-only evidence as limited proof. Do not mark the requirement complete."*
- **Exact Prerequisite for Unblocking**:
  1. Provision a dedicated isolated staging/test database (or a dedicated isolated test PostgreSQL schema with complete table clones).
  2. Configure connection parameters in `.env.test`.
  3. Execute committed bank master provisioning, AP bill payment, statement import, and BRS matching.
  4. Perform process kill and server restart, reconnect to PostgreSQL, and verify records survive across restart.
- **Preserved Limited Evidence**:
  The 6-step transactional rollback test in [`scratch/test_bank_lifecycle_operational_proof.js`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/test_bank_lifecycle_operational_proof.js) remains preserved as proof that auto-provisioning of child GL `1112-99`, zero JEs on bank creation, opening balance voucher, supplier AP disbursement, statement CSV import, and BRS reconciliation operate with **₹0.00 discrepancy**.

---

## 5. Independent PostgreSQL Accounting Invariants (Live PostgreSQL 17.6)

1. **Trial Balance by Account**:
   - `1111` Cash in Hand: Dr ₹0.00 / Cr ₹1,180.00 (Balance: -₹1,180.00)
   - `1114` Petty Cash - Branches: Dr ₹0.00 / Cr ₹200.00 (Balance: -₹200.00)
   - `1121` Accounts Receivable: Dr ₹2,000.00 / Cr ₹0.00 (Balance: ₹2,000.00)
   - `1143` Input CGST 9%: Dr ₹90.00 / Cr ₹0.00 (Balance: ₹90.00)
   - `1144` Input SGST 9%: Dr ₹90.00 / Cr ₹0.00 (Balance: ₹90.00)
   - `4110` Cake & Bakery Sales Revenue: Dr ₹0.00 / Cr ₹2,000.00 (Balance: ₹2,000.00)
   - `5230` Vehicle Fuel & Maintenance: Dr ₹1,200.00 / Cr ₹0.00 (Balance: ₹1,200.00)
   - **Total Debits**: ₹3,380.00 | **Total Credits**: ₹3,380.00 | **Net Difference**: **₹0.00**
2. **Statement of Profit & Loss**:
   - Operating Revenue (`4xxx`): ₹2,000.00
   - Operating Expenses (`5xxx`): ₹1,200.00
   - **Net Operating Profit**: **₹800.00**
3. **Balance Sheet & Accounting Equation**:
   - Total Assets (`1xxx`): ₹2,000 + ₹90 + ₹90 - ₹1,180 - ₹200 = **₹800.00**
   - Total Liabilities (`2xxx`): **₹0.00**
   - Contributed Equity (`3xxx`): **₹0.00**
   - Current Year Net Earnings: **₹800.00**
   - Total Liabilities + Equity: **₹800.00**
   - **Accounting Equation**: $\text{Assets (₹800.00)} \equiv \text{Liabilities (₹0.00)} + \text{Equity (₹800.00)}$ (Exact Match)
4. **Journal Integrity**:
   - Unbalanced Journal Entries: **0**
   - Duplicate Primary Vouchers: **0**
5. **Posting Safety Guards**:
   - `setting.accounting_start_date`: `'2026-04-01'`
   - `accounting_fiscal_period`: 12 monthly periods configured; active period is `October 2026` (`is_locked: false`).

---

## 6. Checkpoint References & Artifacts

- **Clearance Report:** `CHECKPOINTS/complete-accounting-gap-closure-and-durability-audit.md`
- **Latest Checkpoints:**
  - [`LATEST_CHECKPOINT.md`](file:///E:/vig/cakes2home-main/cakes2home-main/LATEST_CHECKPOINT.md)
  - [`CHECKPOINTS/LATEST_CHECKPOINT.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/LATEST_CHECKPOINT.md)
  - [`frontend/LATEST_CHECKPOINT.md`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/LATEST_CHECKPOINT.md)
- **Playwright Browser Evidence Artifacts**:
  - Full Bills Receivable & AR Aging View: [ar_aging_bills_receivable.png](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/bd4c3032-9680-4184-a5d5-db6eac6b478f/ar_aging_bills_receivable.png)
  - Interactive Filtered View: [ar_aging_bucket_filtered.png](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/bd4c3032-9680-4184-a5d5-db6eac6b478f/ar_aging_bucket_filtered.png)
  - E2E Verified Workflow: [e2e_bills_receivable_aging_verified.png](file:///C:/Users/alexc/.gemini/antigravity-ide/brain/bd4c3032-9680-4184-a5d5-db6eac6b478f/e2e_bills_receivable_aging_verified.png)
