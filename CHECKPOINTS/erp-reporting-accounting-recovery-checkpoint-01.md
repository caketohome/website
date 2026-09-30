# ERP REPORTING, REVENUE RECONCILIATION & ACCOUNTING RECOVERY CHECKPOINT

**File**: `CHECKPOINTS/erp-reporting-accounting-recovery-checkpoint-01.md`  
**Timestamp**: 2026-09-22 11:15:00 IST  
**Branch**: `task/dev`  
**Current HEAD Commit**: `f7d9a47073d64b0da305cc537a6eccb45938fd1b` (`fix(checkout): resolve react child object render error, order confirmation address formatting & checkout location ui readability`)  
**Status**: SAFELY PAUSED & FULLY PRESERVED — ZERO CODE/SCHEMA CHANGES DURING PAUSE

---

## 1. Executive Summary & Purpose of Pause

Per user directive, all implementation, refactoring, code alterations, migrations, and git operations were immediately halted. This checkpoint safely captures the complete state of the CakeToHome repository (`E:\vig\cakes2home-main\cakes2home-main`), freezes all progress from the verified frontend regression recovery, and comprehensively documents the architectural audit and business rules established for the upcoming ERP Reporting, Accounting, Purchase, Fleet & Revenue Reconciliation Overhaul.

No application code was altered. No database records or schemas were touched. No git push was executed. The repository remains in a 100% stable, runnable state on branch `task/dev`.

---

## 2. Git & Working Tree Verification State

- **Branch**: `task/dev` (tracked with `origin/task/dev`)
- **HEAD Commit**: `f7d9a47073d64b0da305cc537a6eccb45938fd1b`
- **Working Tree State**: Modified (preserves the 49 modified files and untracked verification artifacts from the approved regression recovery)
- **Staged Changes**: No (`git diff --cached` is empty)
- **Untracked Changes**: Yes (includes verification test scripts and prior audit documents in `scratch/`, `CHECKPOINTS/`, `migration/`)
- **Git Push Executed**: NO
- **Application Code Modified During Pause**: NO
- **Database Migrations / Schema Changes Run During Pause**: NO
- **Deployment Executed**: NO

### Working Tree Diff Summary (`git diff --stat`)
```
 49 files changed, 736 insertions(+), 811 deletions(-)
```
Key modified areas preserved from verified regression recovery:
- `frontend/src/app/api/customer/orders/route.ts` (fixed total extraction from JSONB metadata)
- `frontend/src/lib/repositories/city.repository.ts` (realigned order branch_id attribution)
- `frontend/src/lib/db.ts` (connectionString safety guard)
- `frontend/src/lib/services/order.service.ts` (PostgreSQL order customer_id parameter integrity)
- Cleaned duplicate client files (`customer-client.ts`, `customer-server.ts`, `categories.ts`, `orders-client.ts`, `shops.ts`)

---

## 3. Runtime & Services Health

- **PostgreSQL Database**: Running, healthy. Contains 173 orders, 57 branches, 65 products.
- **Frontend Dev Server**: Running on `task-93` (Next.js server active, compilation stable).
- **TypeScript Typecheck**: Verified clean (0 errors) in prior verification gate.
- **ESLint**: Verified clean (0 errors).
- **Production Build**: Verified clean (30/30 pages compile).

---

## 4. Architectural Audit: Identified Reporting & Accounting Gaps

During the exploratory audit of the Analytics / ERP Reporting system (`frontend/src/lib/reports-engine-data.ts`, `frontend/src/app/dashboard/reports/`, `frontend/src/lib/excel-export-service.ts`), the following critical architectural and data-integrity defects were identified:

### 4.1. Bounded Order Fetching (The 100-Order Limit)
- **Finding**: In `frontend/src/lib/reports-engine-data.ts`, `refreshAllData()` invokes `apiClient.getOrders()` which calls `GET /api/v1/orders`. The underlying repository (`OrderRepository.findAll()`) enforces a default hard ceiling of `LIMIT 100`.
- **Consequence**: In a database with 173+ orders, 73 orders are omitted from in-memory aggregation. Totals, counts, and historical reporting are incomplete and inaccurate.
- **Remedy Required**: Implement dedicated database-level SQL aggregation endpoints for reports (e.g. `GET /api/v1/admin/reports/...`) or bounded full pagination aggregation, eliminating frontend slice limits.

### 4.2. Attribution to "Unassigned" & City Mapping Deficiencies
- **Finding**: City and Area performance methods in `reports-engine-data.ts` (`getCityPerformance`, `getAreaPincodePerformance`) perform naive string lookups on unstandardized address strings. If an order lacks an exact city token match, it defaults to `"Unassigned"`.
- **Consequence**: Legitimate orders in Bengaluru are dropped into "Unassigned", skewing regional volume and conversion metrics.
- **Remedy Required**: Deterministic normalization pipeline: extract pincode -> map to Bengaluru kitchen zone/locality -> associate with valid city and operational kitchen branch.

### 4.3. Empirical & Test Branch Contamination
- **Finding**: The PostgreSQL `branch` table contains 57 branch records, including empirical/test entries created during automated test suites (e.g. mock test branches). The reporting dashboard loads all branches without distinguishing `is_active` or operational production branches.
- **Consequence**: Test branch names pollute executive dashboards, confusing store managers and finance teams.
- **Remedy Required**: Filter branch queries to operational, active kitchen branches only (`is_active = true` and operational branch flags); gracefully archive test branches without violating foreign keys.

### 4.4. Semantic Payment Method Duplication
- **Finding**: Payment method labels are currently grouped by raw text values: `'COD'`, `'cash_on_delivery'`, `'CASH ON DELIVERY (COD)'`, `'Razorpay'`, `'online'`, `'razorpay'`.
- **Consequence**: Payment breakdown charts and tables display duplicate buckets for identical payment mechanisms, dividing cash and online figures.
- **Remedy Required**: Enforce a strict canonical enum mapping:
  - `COD`: Cash On Delivery
  - `RAZORPAY`: Razorpay Online Gateway
  - `UPI`: Direct UPI
  - `CARD`: Credit / Debit Card
  - `NETBANKING`: Internet Banking
  - `WALLET`: Digital Wallet

### 4.5. Financial Recognition & Date Misalignment
- **Finding**: Current revenue reporting groups transactions solely by `o.created_at` (order booking timestamp).
- **Business Rule Violation**:
  - For **Prepaid Orders**: Revenue/cash is collected at order booking (`created_at`). It must NOT be counted as new cash collected on delivery day.
  - For **COD Orders**: Cash is collected only upon physical delivery (`delivered_at`). At booking, it represents booked pipeline/receivable, NOT collected cash.
  - For **Split / Advance Payments**: Advance is recognized on booking date; remainder is collected and recognized on delivery date.
- **Remedy Required**: Implement a three-tier date model:
  1. **Order Date (Booking)**: Placed volume, gross booked pipeline.
  2. **Delivery Date (Fulfillment)**: Units fulfilled, delivery performance.
  3. **Payment Date (Cash Reconciliation)**: Actual cash/bank inflow by date collected.

### 4.6. Excel Export Discrepancy
- **Finding**: `excel-export-service.ts` uses separate transformations from the UI view rendering, causing columns, headers, and computed totals in generated spreadsheets to deviate from what is shown on screen.
- **Remedy Required**: Bind Excel exports directly to the unified tabular models rendered in the UI with exact row-for-row and column-for-column fidelity.

---

## 5. Scope & Strict Boundaries for the Next Phase

The following tasks were queued and explicitly paused:
1. **NO code implementation** has started.
2. **NO accounting modules** have been created or modified.
3. **NO Excel export adjustments** have been applied.
4. **NO database migrations** have been executed.
5. All work will strictly await explicit user approval and instructions before proceeding.

---

## 6. Recovery Instructions for Resuming

When the user gives the instruction to resume:
1. Confirm git working tree is unchanged via `git status` and `git diff --stat`.
2. Review this checkpoint and `CHECKPOINTS/LATEST_CHECKPOINT.md`.
3. Develop a formal, step-by-step Implementation Plan addressing:
   - SQL-level aggregation for reporting (eliminating the 100-order limit).
   - Real operational branch filtering and area/pincode attribution.
   - Canonical payment method normalization.
   - Revenue recognition engine (Booked vs Delivered vs Collected).
   - Excel export alignment.
4. Wait for explicit user approval on the plan before touching any production source code.
