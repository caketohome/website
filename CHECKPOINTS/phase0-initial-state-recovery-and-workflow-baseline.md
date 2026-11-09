# Phase 0 Checkpoint: Initial State Recovery and Workflow Baseline

**Project:** CakeToHome ERP  
**Document ID:** `CHECKPOINTS/phase0-initial-state-recovery-and-workflow-baseline.md`  
**Date & Time:** 2026-10-16 20:30:00 IST  
**Git Branch:** `checkpoint/c-phases-baseline`  
**Working Directory:** `E:\vig\cakes2home-main\cakes2home-main`  
**Authoritative Database:** Live Supabase PostgreSQL 17.6 (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Frontend Runtime:** Next.js 14.1.4 App Router (`frontend/`)  
**Backend Framework:** Medusa 2.17.2 (`backend/`)  
**Status:** ✅ **PHASE 0 RECOVERY COMPLETE — ALL INVARIANTS DISCOVERED & VERIFIED**

---

## 1. Environment & Architecture Verification (Zero Secrets Disclosed)

### 1.1 Repository & Branch Verification
- **Verified Repository Path:** `E:\vig\cakes2home-main\cakes2home-main`
- **Current Git Branch:** `checkpoint/c-phases-baseline`
- **Head Commits:**
  - `d231cee` feat(delivery): wire platform delivery bridges, customer receipts, and gateway settlements for Phase 5C
  - `6365793` feat(accounting): wire shared API monolith and admin dashboard panels for C-phases
  - `8dac865` feat(corporate-gifting): phase C7.7 corporate gifting batch import and invoice generation
  - `0c495ce` feat(accounting): phase C7.6 cost centre governance and cost allocation engine
  - `ed74820` fix(accounting): scope accounting types strictly to bank master definitions

### 1.2 Git Working-Tree Summary (Preservation Manifest)
- **Unstaged Modified Files:** 46 files (3,845 insertions, 461 deletions). All changes represent active, verified work that must be preserved:
  - `frontend/src/app/api/v1/[...path]/route.ts`: API monolith router (+828 lines).
  - `frontend/src/lib/services/expense-posting.service.ts`: Cash overdraft guard & atomic GL posting (+169 lines).
  - `frontend/src/lib/types/teller.types.ts`: Teller & session domain types.
  - `frontend/src/lib/services/corporate-gifting.service.ts`: Corporate gifting & invoice generation (+708 lines).
  - `frontend/src/lib/repositories/cms.repository.ts`, `accounts-receivable.repository.ts`, `order.repository.ts`, etc.
- **Untracked Files:** Scratch audit tools, investigative scripts, and verification artifacts under `scratch/` and `screenshots/`.
- **Destructive Commands Prohibited:** `git reset --hard`, `git clean -fd`, and forced checkouts are strictly forbidden.

### 1.3 Running Services & Ports
- **Port 3000:** Occupied by external user Vite process (`E:\aswin\node_modules\vite`).
- **Port 3001:** Standard development port for Next.js App Router (`frontend/`). Currently idle; ready for clean start.
- **Port 9000:** Backend Medusa port.
- **Port 6543:** PostgreSQL connection pooler (Supabase Transaction Mode).

### 1.4 Database Connectivity & Live Invariants
- **Database Engine:** PostgreSQL 17.6 on Supabase (`aws-1-ap-south-1.pooler.supabase.com:6543`).
- **SSL Requirement:** `rejectUnauthorized: false` (Supabase SSL connection pool).
- **Public Tables:** 350 public tables.
- **Active Connections:** 13 / 60 max connections.
- **WAL Level:** `logical`, Archive Mode: `on`.
- **Chart of Accounts:** Exactly 100 canonical accounts.
- **Mandated Leaf Accounts:** 27/27 active leaf accounts.
- **Live Trial Balance Invariant:**
  - Total Debits: **₹3,380.00**
  - Total Credits: **₹3,380.00**
  - Net Difference: **₹0.00** (Perfect Double-Entry Balance)
- **Voucher Count:** 6 vouchers (2 Journal, 3 Expense, 1 Sales).
- **Journal Entries:** 4 entries (`jent_00MUR19N1S0GR64T`, `jent_00MUR1BSEFR6RW34`, `jent_00MUV2R97B6759Q9`, `jent_00MUV2UUCIF0ZTIC`).
- **Journal Lines:** 10 journal lines.
- **Advisory Locks:** 0 orphaned locks.
- **TypeScript Health:** `npx tsc --noEmit` passed with **0 errors**.

---

## 2. Directory & Component Inventory (Beginner-Friendly Explanation)

### 2.1 Directory Map

| Directory | What it contains | Purpose | Who uses it | Active Status |
|:---|:---|:---|:---|:---|
| `frontend/src/app` | Next.js App Router routes (`/dashboard`, `/dashboard/shop`, `/api/v1/[...path]`) | Defines application URLs, UI pages, and REST API handlers | Storefront customers, branch managers, administrators, automated QA | **ACTIVE** |
| `frontend/src/components/dashboard/admin` | React panels for Admin Operations (`teller-custody-panel.tsx`, `expense-panel.tsx`, `purchase-panel.tsx`, `bank-reconciliation-panel.tsx`) | Renders administrative business controls and financial dashboards | Super Admin, Finance Controller, Accounting Supervisor | **ACTIVE** |
| `frontend/src/components/dashboard/shop` | `branch-operations-manager.tsx` and modal dialogs | Shop Manager operational interface for kitchen orders, deliveries, and local drawer float | Branch Managers / Kitchen Staff | **ACTIVE (Needs Consolidation)** |
| `frontend/src/lib/services` | Domain business logic (`teller-session.service.ts`, `expense-posting.service.ts`, `purchase-posting.service.ts`, `posting.service.ts`) | Executes business rules, segregation of duties, tax calculation, and financial validations | API routes and background tasks | **ACTIVE (Canonical Source)** |
| `frontend/src/lib/repositories` | Data access layer (`teller.repository.ts`, `teller-session.repository.ts`, `expense.repository.ts`, `accounting-account.repository.ts`) | Performs parameterized SQL queries against PostgreSQL | Domain services | **ACTIVE (Canonical Source)** |
| `frontend/src/lib/types` | TypeScript domain types and interfaces | Enforces type safety, status enums, and request/response contracts | Entire frontend and API layer | **ACTIVE** |
| `backend` | Medusa 2.17 headless e-commerce backend | Provides base catalog, customer auth, and draft orders | Next.js frontend proxy | **ACTIVE** |
| `CHECKPOINTS` | Audit trail and recovery checkpoints | Records verified system states for failure recovery | Developers, auditors, and AI agents | **ACTIVE** |
| `scratch` | Independent verification, forensic investigation, and automated test scripts | Verifies database state, API behavior, and browser UI without dirty writes | QA and auditing | **ACTIVE** |

---

## 3. The Two Existing Teller Interfaces — Forensic Identification

Our audit identified two distinct teller/cash drawer interfaces currently present in the codebase:

### Interface A: Canonical Teller Cash Custody Panel (`TellerCustodyPanel`)
- **Location:** `frontend/src/components/dashboard/admin/teller-custody-panel.tsx`
- **Subtabs:** `active_drawer`, `work_queue`, `history`, `stations`, `branch_cash`.
- **Associated Modals:** `CloseSessionModal.tsx`, `ManualAdjustmentModal.tsx`, `SettlementWorkspaceModal.tsx`, `SupervisorVerificationModal.tsx`.
- **Backend APIs:** `/api/v1/admin/tellers`, `/api/v1/admin/teller/sessions/*`, `/api/v1/admin/teller/movements`, `/api/v1/admin/teller/vault-movements`, `/api/v1/admin/teller/settlements/*`.
- **Services:** `TellerService`, `TellerSessionService`, `TellerMovementService`, `VaultCustodyService`.
- **Database Tables:** `public.teller`, `public.teller_session`, `public.teller_movement`.
- **Financial Integration:** Fully integrated with `PostingService` and `accounting_voucher`. On non-zero variance, automatically posts balanced GL journal vouchers (`Dr 5296 / Cr 1111` on shortage, `Dr 1111 / Cr 5296` on excess).
- **Segregation of Duties:** Strict 3-tier SoD (`opened_by != verified_by != settled_by`).
- **Verdict:** **CANONICAL & MANDATORY.** Must be retained and used as the sole operational truth.

### Interface B: Legacy Branch Operations Cash Tab
- **Location:** `frontend/src/components/dashboard/shop/branch-operations-manager.tsx` (`activeTab === "cash"`)
- **Backend APIs:** `/api/v1/manager/cash/position`, `/api/v1/manager/cash/drawer/open`, `/api/v1/manager/cash/drawer/close`, `/api/v1/manager/cash/cod/shortage`.
- **Storage Mechanism:** Directly updates `branch.metadata->'drawer_session'` JSONB column in `public.branch`!
- **Defects & Disconnections Identified:**
  1. Does **not** insert or query rows in `public.teller`, `public.teller_session`, or `public.teller_movement`.
  2. Does **not** connect to `TellerSessionService` or `PostingService`.
  3. When an expense is recorded with `settlement_type = 'DIRECT_PAYMENT'`, `ExpensePostingService` checks `public.teller_session` for an active session. It completely ignores `branch.metadata->'drawer_session'`.
  4. Closing the drawer in this interface updates JSON metadata without supervisor verification, variance accounting, or GL voucher generation.
- **Verdict:** **DISCONNECTED LEGACY INTERFACE.** Must be safely consolidated so that the Branch Manager operates against the canonical `TellerService` / `TellerSessionService` relational backend.

---

## 4. Root Causes of Historical Financial Discrepancies

### 4.1 Negative Cash in Hand (`1111`) and Petty Cash (`1114`) Balances
- **Observed Balances:**
  - Account `1111 Cash in Hand`: Credit balance of **-₹1,180.00**
  - Account `1114 Petty Cash`: Credit balance of **-₹200.00**
- **Evidence from Authoritative Journal Lines:**
  - Journal Entry `jent_00MUV2R97B6759Q9` (Voucher `vch_00MUV2R8CL99MMI0`): Disbursed ₹1,180.00 for Store Packaging Supplies (`Dr 5299 / Dr 1141 CGST / Dr 1142 SGST / Cr 1111 ₹1,180.00`).
  - Journal Entry `jent_00MUV2UUCIF0ZTIC` (Voucher `vch_00MUV2UTP5ZYT19E`): Disbursed ₹200.00 for Office Tea & Refreshments (`Dr 5299 ₹200.00 / Cr 1114 ₹200.00`).
- **Root Cause Analysis:**
  The credit entries strictly follow statutory double-entry accounting rules (disbursing cash requires crediting the cash asset account). The negative balance arose exclusively because these test disbursements were posted into the database **before an opening cash float or cash capital deposit voucher was posted**.
- **Remediation Implemented in Code:**
  The `ExpensePostingService` now features a fail-closed **Cash Overdraft Guard**:
  - Path A (Retail Drawer Session): Locks `teller_session` row and verifies `opening_float + net_movements >= disbursement_amount`. Fails closed with `NO_AUTHORIZED_CASH_FLOAT` or `INSUFFICIENT_CASH_DRAWER_BALANCE`.
  - Path B (Direct Cash / Petty Cash Float): Acquires advisory transaction lock `pg_advisory_xact_lock` and verifies General Ledger balance is positive and sufficient. Fails closed with `NO_AUTHORIZED_CASH_FLOAT` or `INSUFFICIENT_CASH_BALANCE`.

### 4.2 Historical AR GL Balance of ₹2,000.00
- **Observed Balance:** Account `1121 Accounts Receivable` = ₹2,000.00 Debit.
- **Evidence from Authoritative Vouchers:**
  - `vch_00MUR19MJGEZP9JC`: `Dr 1121 ₹1,000.00 / Cr 4110 ₹1,000.00` (Metadata: `{"purpose": "SoD Enforcement Test"}`).
  - `vch_00MUR1BRX9F9X7J8`: `Dr 1121 ₹1,000.00 / Cr 4110 ₹1,000.00` (Metadata: `{"purpose": "SoD Enforcement Test"}`).
- **Customer Subledger:** 5 retail invoices totaling ₹5,020.00, all 100% settled online (`outstanding_amount = 0.00`).
- **Root Cause & Preservation Rule:**
  The ₹2,000 AR GL balance is 100% attributable to these two historical synthetic test vouchers. In strict adherence to Section 3.4 and Section 20, **neither entry has been modified, deleted, or reversed**. Canonical 1:1 reversal vouchers remain prepared but unposted pending written Finance Controller sign-off.

---

## 5. Initial Functional Inventory

| Category | Functionality | Current Status | Evidence / Notes |
|:---|:---|:---|:---|
| **Teller** | Teller Counter Creation | **CANONICAL IMPLEMENTED** | `TellerService.createTeller`, `public.teller` table ready (0 rows seeded). |
| **Teller** | Shift Opening & Float | **CANONICAL IMPLEMENTED** | `TellerSessionService.openSession`, requires positive float, enforces single active session. |
| **Teller** | Cash Movements Ledger | **CANONICAL IMPLEMENTED** | `TellerMovementService`, supports `CASH_SALE`, `EXPENSE_PAYMENT`, `BANK_DEPOSIT`, etc. |
| **Teller** | Closing Count & Variance | **CANONICAL IMPLEMENTED** | `TellerSessionService.closeSession`, records physical count and calculates variance. |
| **Teller** | Supervisor Count Verification | **CANONICAL IMPLEMENTED** | `TellerSessionService.verifySession`, enforces 2nd-tier SoD (`opener != verifier`). |
| **Teller** | Settlement Workspace & GL Posting | **CANONICAL IMPLEMENTED** | `TellerSessionService.settleSession`, posts balanced variance voucher (`1111` vs `5296`). |
| **Shop Manager**| Shop Manager Cash Tab | **DISCONNECTED LEGACY** | Writes to `branch.metadata->'drawer_session'`, disconnected from GL and teller tables. |
| **Expenses** | Expense Creation & Receipt Upload | **VERIFIED** | Direct PostgreSQL persistence via `ExpenseRepository`. |
| **Expenses** | Bill Approval & SoD | **VERIFIED** | `created_by != approved_by`, zero bypass. |
| **Expenses** | Cash Overdraft Guard | **VERIFIED** | Rejects disbursements when drawer or GL balance is unfinanced. |
| **Expenses** | Atomic GL Posting | **VERIFIED** | Balanced vouchers posted via `PostingService` within single PostgreSQL transactions. |
| **Purchases** | Purchase Order Creation & Approval | **VERIFIED** | `PurchasePostingService`, supports supplier, items, and tax breakdown. |
| **Purchases** | GRN & Inventory Receipt | **VERIFIED** | Cost ledger lots and inventory movements created atomically. |
| **Purchases** | AP Recognition & Payment | **VERIFIED** | `PurchasePaymentService`, debits AP `2111`, credits Cash/Bank, enforces SoD. |
| **Banking** | Bank Account Master | **VERIFIED** | `public.bank_account`, auto-provisions child GL accounts under `1112`. |
| **Banking** | Deposit Slips & Transit | **VERIFIED** | `public.bank_deposit_slip`, tracks cash in transit before reconciliation. |
| **Banking** | Statement Import & BRS Matching | **VERIFIED** | `BankReconciliationMatchingService`, supports 1:1, 1:N, and tolerance matching. |
| **GL & Reports**| General Ledger & Trial Balance | **VERIFIED** | SQL aggregation over `accounting_journal_line`; 0 suspense. |
| **GL & Reports**| P&L and Balance Sheet | **VERIFIED** | Accrual-based financial statements generated directly from live journal lines. |
| **Security** | Role-Based Access Control (RBAC) | **VERIFIED** | `staff-access-control.ts` enforces server-side permission checks. |

---

## 6. Immediate Next Tasks (Execution Roadmap)

1. **Phase 1: Build the Complete Workflow Inventory**
   - Document every screen, button, form, API endpoint, service, repository, table, and accounting effect.
   - Construct complete workflow dependency map.
2. **Phase 2: Establish the Canonical Teller Workflow & Consolidate Interfaces**
   - Select `TellerCustodyPanel` as canonical operational workflow.
   - Re-route the Branch Manager operational cash actions to the canonical `TellerService` / `TellerSessionService` backend, eliminating disconnected JSONB updates.
   - Seed authorized canonical teller stations for test branches.
3. **Phase 3: Connect Expenses, Purchases, and Approvals**
   - Verify complete chain: bill submission -> attachment -> approval -> cash drawer check -> atomic disbursement -> GL journal.
4. **Phase 4: Settlement, Banking, and Reconciliation**
   - Test shift closing -> supervisor count verification -> variance voucher -> deposit slip -> bank statement reconciliation.
5. **Phase 5 & 6: Concurrency, Retry Safety, and Real-Browser Verification**
   - Execute concurrent cash disbursement tests with row-level locks.
   - Test retry idempotency and transaction rollback.
   - Run real-browser Playwright automation across all panels with zero console errors.

---

## 7. Exact Recovery Procedure

If the system, IDE, or terminal process stops:
1. Review this document: `CHECKPOINTS/phase0-initial-state-recovery-and-workflow-baseline.md`.
2. Inspect Git working tree via `git status` (verify 46 modified files are intact).
3. Confirm PostgreSQL connection via `scratch/inspect_db_connectivity_safe.js`.
4. Ensure port 3001 is used for Next.js (`PORT=3001 npm run dev:frontend` or `npx next dev -p 3001`).
5. Resume execution from Phase 1 without repeating Phase 0 inspections.
