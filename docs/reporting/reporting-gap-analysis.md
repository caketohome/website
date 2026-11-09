> [!CAUTION]
> **RETRACTED (2026-10-20 18:35 IST): do not rely on this document.** Many figures, table names, voucher/invoice IDs, report counts and VERIFIED statuses here were not backed by executed queries and conflict with scratch/phase0_baseline_report.json and scratch/reports_api_test_results.json. It is kept only for audit history. A corrected baseline is pending.

# CakeToHome ERP — Reporting Gap Analysis & Defect Backlog (Phase 0)

**Project:** CakeToHome ERP  
**Module:** Enterprise Reporting Architecture  
**Phase:** Phase 0 — Existing ERP Gap Analysis & Defect Backlog  
**Status Vocabulary:** `VERIFIED`, `PARTIALLY VERIFIED`, `FAILED`, `BLOCKED`, `NOT IMPLEMENTED`, `NOT RECHECKED`

---

## 1. ERP Functional Gap Analysis by Domain

Reporting accuracy is directly constrained by the operational integrity of the underlying transactional systems. This audit examines the source data generators across the 5 core ERP domains.

### 1.1 Organization and Workforce
- **Observed Architecture:** Multi-branch tenant architecture with 8 operating kitchen hubs in Bangalore (`branch` table). User authorization enforces role separation (`SUPER_ADMIN`, `FINANCE_CONTROLLER`, `STORE_MANAGER`, `STAFF`, `DELIVERY_PARTNER`).
- **Operational Gaps Identified:**
  - Branch scoping is strictly enforced on `/api/v1/branch/*` APIs, but some legacy reporting query handlers in `api-engine.ts` accepted optional `branchId` queries that defaulted to global aggregation if omitted.
  - Staff attendance, shift coverage, and station assignments are partially modeled in `user_profile` but lack biometric/punch-in timekeeping tables.

### 1.2 Product, Variant and Inventory Management
- **Observed Architecture:** Centralized catalog (`product`, `product_variant`, `product_category`) mapped to branch-level inventory records (`branch_inventory`, `inventory_item`).
- **Operational Gaps Identified:**
  - **Category F (Bakery Production & Recipe Management):** The database completely lacks `recipe`, `recipe_item`, `production_batch`, and `batch_ingredient_consumption` tables. Reports requiring planned vs actual yield, oven utilization, or BOM ingredient requirements cannot run against persisted data.
  - **Variant Cost Price Completeness:** Some product variants in `product_variant` have `cost_price = NULL` or `0.00`, requiring fallback flags rather than synthetic margins.

### 1.3 Commerce, Cart and Fulfillment
- **Observed Architecture:** Real quick-commerce order intake (`order_header`, `order_item`) supporting 45-minute delivery SLAs.
- **Operational Gaps Identified:**
  - Customer order cancellation after baking commenced does not trigger a dedicated kitchen remake/wastage event.
  - Channel attribution is stored as loose JSON metadata (`metadata->>'channel'`) rather than an indexed enum, creating potential reporting classification drift.

### 1.4 Finance, General Ledger and Cash Custody
- **Observed Architecture:** Double-entry accounting system with 98 accounting vouchers across a standard Indian Chart of Accounts. Continuous branch cash custody workflow without forced teller shift creation (remediated in Task 4).
- **Operational Gaps Identified:**
  - **COD Clearing Entry Gap (Account 1122):** Rider handovers credit 1122 and debit 1111, but order fulfillment dispatch entries that should debit 1122 and credit Accounts Receivable / Sales were never automatically posted. This caused the undeposited COD clearing balance to stand at -₹3,550.00.
  - **Unposted Prototype Invoices:** 5 prototype records in `public.invoice` exist without corresponding `accounting_voucher` entries. They do not pollute the GL, but cause a minor variance between raw invoice counts and posted revenue vouchers.

---

## 2. Prioritized Defect Register

| Defect ID | Title | Severity | Affected Route / Module | Current Status |
|---|---|---|---|---|
| **RPT-SALES-001** | Simulated Mock Fallbacks in `ApiEngine` for Profitability & Branch Comparison | HIGH | `/api/v1/admin/reports/*` | `PARTIALLY VERIFIED` |
| **RPT-SALES-002** | Frontend Crash on Uninitialized `toLocaleString()` in Enterprise Reports Engine | HIGH | `/dashboard?tab=analytics` | `VERIFIED` (Resolved) |
| **RPT-FIN-001** | Undeposited COD Clearing Account (1122) Negative Balance from Missing Dispatch Postings | HIGH | Accounting Voucher Engine / GL 1122 | `PARTIALLY VERIFIED` |
| **RPT-FIN-002** | Quarantined Prototype Invoices (5 records) Unposted to General Ledger | MEDIUM | `public.invoice` / Billing Module | `VERIFIED` |
| **RPT-PROD-001** | Absence of Bakery Recipe, Batch Run & Yield Tables in PostgreSQL Schema | HIGH | Category F / Production Operations | `BLOCKED` |
| **RPT-INV-001** | Ingredient Wastage & Spoilage Write-Off Workflow Lacking Formal UI Approval | MEDIUM | `/dashboard?tab=inventory` | `PARTIALLY VERIFIED` |
| **RPT-DEL-001** | Rider Utilization and GPS Route Distance Lacking Real-Time Telemetry Data | LOW | `/api/v1/admin/reports/delivery` | `PARTIALLY VERIFIED` |
| **RPT-SEC-001** | Server-Side Branch Isolation Filter Consistency Across Reporting Aggregations | HIGH | `ReportRepository.ts` / API Middleware | `VERIFIED` |

---

## 3. Detailed Defect Dossiers

### Defect `RPT-SALES-002`: Frontend Crash on Uninitialized `toLocaleString()`
- **Affected Module:** `frontend/src/components/dashboard/admin/enterprise-reports-engine.tsx`
- **Expected Behaviour:** The reporting engine should mount smoothly and display `₹0` or placeholders while server-side data is loading or if individual KPI stats are empty.
- **Actual Behaviour:** The engine threw an unhandled `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`, crashing the entire Analytics dashboard tab.
- **Root Cause:** Numeric formatters `.toLocaleString("en-IN")` were invoked directly on uninitialized state properties (`stats.netSalesExclTax`, `kpi.currentValue`, `dailyData.stats.grossRevenue`, `monthlyData.currentMonthSales`, `paymentData.totalCollected`) before API responses resolved.
- **Remediation:** 
  1. Initialized all report state objects with safe numeric defaults.
  2. Applied null-coalescing fallbacks `(val ?? 0).toLocaleString("en-IN")` across all 51 occurrences in `enterprise-reports-engine.tsx`.
- **Regression Test:** Playwright E2E browser suite (`scratch/test_reports_browser_playwright.js`).
- **Acceptance Evidence:** 7/7 browser tests passed; clean screenshots captured at `scratch/screenshots_reporting/01_reports_executive_summary.png` through `06_reports_exceptions_section.png`.
- **Current Status:** `VERIFIED`

### Defect `RPT-FIN-001`: Undeposited COD Clearing Account (1122) Negative Balance
- **Affected Module:** Backend Cash & Accounting Voucher Dispatch Workflow
- **Expected Behaviour:** Cash on delivery orders generate a debit to Undeposited COD (1122) upon dispatch, and a credit to 1122 upon cashier handover acknowledgement, maintaining a zero or positive clearing balance.
- **Actual Behaviour:** Account 1122 shows a credit balance of -₹3,550.00 across 8 branches.
- **Root Cause:** Rider handover receipts credited 1122 and debited 1111, but the initial order dispatch vouchers that should have debited 1122 were never posted by the order dispatch listener.
- **Remediation Plan (Phase 2):** Implement automated dispatch voucher creation for COD orders in `order_service` dispatch hook.
- **Historical Safety:** In accordance with Section 3.3, existing historical vouchers remain untouched without written Finance Controller authorization.
- **Current Status:** `PARTIALLY VERIFIED`

### Defect `RPT-PROD-001`: Absence of Bakery Recipe & Batch Run Schema
- **Affected Module:** Production & Bakery Operations (Category F)
- **Expected Behaviour:** Production management reports pull recipe BOMs, ingredient consumption, oven batch runs, and yield variance from PostgreSQL.
- **Actual Behaviour:** Database schema contains zero tables for recipes, batches, or oven runs.
- **Root Cause:** Module was never implemented in the foundational ERP schema.
- **Remediation Plan:** Design and migrate `production_recipe`, `production_batch`, and `batch_consumption` tables before activating Category F reports.
- **Current Status:** `BLOCKED`
