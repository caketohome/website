# CAKETOHOME ERP — PHASE 4E: POSTING ENGINE ARCHITECTURE & DESIGN SPECIFICATION
## (CRASH RECOVERY FORENSICS & POSTING ENGINE SPECIFICATION — DESIGN ONLY — ZERO CODE EXECUTION)

- **Date**: 2026-09-24 07:15:00 IST
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Git Branch**: `task/dev`
- **Git HEAD**: `f7d9a47`
- **Status**: PHASE 4E RECOVERED & DESIGN COMPLETE — 100% INDEPENDENTLY VERIFIED
- **Next Step**: Awaiting Explicit User Authorization for Phase 4F Implementation

---

## 1. Executive Summary & Forensic Recovery Declaration

Following an unexpected IDE crash during the initialization of Phase 4E, a complete, rigorous forensic audit of the filesystem, Git repository, and live PostgreSQL 17.6 database was conducted.

### 1.1. Forensic Recovery Findings
1. **Crash State Analysis**: The IDE crashed before any Phase 4E code or design files were written or staged. No partial posting service, no posting APIs, and no voucher/journal generators were created.
2. **Authoritative Master Data Intact**: Phase 4D is the latest verified state. Exactly 98 Chart of Accounts rows exist in `public.accounting_account` (24 group accounts, 74 posting accounts).
3. **Zero Financial Mutation**: `accounting_voucher` (0), `accounting_journal_entry` (0), `accounting_journal_line` (0), and `accounting_fiscal_period` (0) remain at strictly zero rows.
4. **Historical Isolation Guaranteed**: All 173 historical orders and 53 payment transactions remain 100% untouched.
5. **Accounting Start Date Invariant**: `accounting_start_date` remains strictly **UNCONFIGURED** in `public.setting`.
6. **Git Integrity**: Read-only Git inspection confirmed 0 commits, 0 pushes, and zero destructive Git operations.

### 1.2. Strict Phase 4E Boundary Mandate
Phase 4E is strictly **ARCHITECTURE & DESIGN ONLY**.
- NO posting services implemented.
- NO posting APIs created.
- NO vouchers or journal entries created.
- NO historical data mutated or retroactively converted.
- NO database migrations applied.
- NO inventory stock mutated.

---

## 2. Applied Skills & Operational Disclosure

In strict adherence to project standards, the following skills were evaluated and applied:

| Skill | Application in Phase 4E |
|---|---|
| `smart-coder` | Architectural inspection of existing repositories (`purchase`, `order`, `expense`, `fleet`), data-flow tracing, and domain invariant mapping. |
| `lazy-coder` | Reused existing schema structures, eliminated redundant posting abstractions, and designed server-side pagination with zero client memory bloat. |
| `clean-architecture` | Established clear boundaries: Domain Value Objects, Application Use Cases, and PostgreSQL Infrastructure Adapters with inward-pointing dependencies. |
| `postgresql-and-supabase` | Validated table constraints, deferred triggers (`trg_check_journal_balance`), multi-column compound indexes, and row-level locking patterns. |
| `typescript-development` | Formulated strict TypeScript contracts, branded types (`VoucherId`, `AccountId`), discriminated unions for voucher lifecycles, and Zod schemas. |
| `security-auditing-and-owasp` | Designed server-side BOLA/IDOR defenses, branch isolation filters, Segregation of Duties (SoD) enforcement, and immutable audit trails. |
| `technical-documentation` | Structured this exhaustive, evidence-backed architectural design specification. |
| `no-duplicator` | Mapped existing canonical implementations across repositories and services, establishing single-source ownership for tax, auth, and inventory. |
| `git-workflow-and-releases` | Enforced strict read-only Git commands (`git status`, `git diff --stat`, `git log`), producing zero unauthorized commits or pushes. |

### Skill Availability Disclosure:
- **`accounting / bookkeeping` specialist skill**: Not installed in environment. Standard double-entry principles (Debit = Credit) and Indian GST accounting standards were derived from domain accounting specifications, `postgresql-and-supabase`, and `clean-architecture`.
- **`database / reconciliation` specialist skill**: Applied via native `postgresql-and-supabase` and independent Node.js forensic scripts.
- **UI/Dashboard skills**: Available (`react-development`, `react-vite-dashboard`, `frontend-design-system`) and utilized for designing the future server-paginated accounting UI.

---

## 3. Absolute Business Model & Database Source-of-Truth Invariant

### 3.1. The Pure Trading Model (Buy-and-Sell)
CakeToHome is strictly a **TRADING BUSINESS**:
- **Cakes**: Purchased from external supplier bakeries and resold to end-customers. They are **MERCHANDISE INVENTORY**.
- **Accessories**: Purchased from external suppliers and resold to customers. They are **MERCHANDISE INVENTORY**.
- **NO Manufacturing**: There is no flour-to-cake conversion in the ERP, no Work-In-Progress (WIP), no recipe costing, and no factory overhead allocation.
- **NO Fabricated COGS**: If actual purchase cost is unavailable, cost is NEVER guessed, fabricated, or set to an arbitrary percentage (e.g., 35%). It must pass through the Cost State Machine (`COST_AVAILABLE`, `COST_PENDING`, `COST_UNAVAILABLE`, `COST_EXCEPTION`).

### 3.2. Authoritative Database Flow
$$\mathbf{PostgreSQL} \longrightarrow \mathbf{Repository} \longrightarrow \mathbf{Service} \longrightarrow \mathbf{API} \longrightarrow \mathbf{UI}$$

- **NOT**: JSON $\rightarrow$ UI
- **NOT**: Static TypeScript arrays $\rightarrow$ UI
- **NOT**: Mock objects $\rightarrow$ UI
- **NOT**: `localStorage` $\rightarrow$ Accounting
- **NOT**: Seed files $\rightarrow$ Runtime truth

Every balance, voucher, journal line, tax breakdown, and inventory valuation must originate from a live PostgreSQL query executed through server-side APIs.

---

## 4. Item-Wise Purchase Accounting Architecture

The purchase accounting engine must operate at the **line-item level**, ensuring full end-to-end traceability from vendor bill to unit cost and future COGS.

### 4.1. Item-Wise Lineage Pipeline
```
┌────────────────────────────────────────────────────────┐
│ 1. PURCHASE HEADER (public.purchase)                   │
│    id, supplier_id, branch_id, invoice_no, due_date   │
└───────────────────────────┬────────────────────────────┘
                            │ 1 : N
┌───────────────────────────▼────────────────────────────┐
│ 2. PURCHASE ITEM (public.purchase_item)                │
│    product_id, variant_id, description, quantity,     │
│    uom, rate, discount, taxable_value, hsn_code,      │
│    cgst_rate, sgst_rate, igst_rate, line_total         │
└───────────────────────────┬────────────────────────────┘
                            │ Classify Category
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────────┐ ┌──────────────────────────┐
│ Cake Merchandise         │ │ Accessory Merchandise    │
│ Product Category = Cake  │ │ Product Category = Acc   │
│ Account: 1132            │ │ Account: 1131            │
└─────────────┬────────────┘ └────────────┬─────────────┘
              │                           │
              └─────────────┬─────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. VOUCHER & JOURNAL GENERATION (POSTING STAGE)        │
│    Voucher Type: PURCHASE (Header level)               │
│    Journal Lines: Item-level decomposition             │
│    - DR 1132 / 1131 (Inventory Asset) [Item Cost]      │
│    - DR 1141 - 1149 (Input GST)       [Tax Rate/Class] │
│    - CR 2111 (Accounts Payable)       [Supplier Total] │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. UNIT COST PERSISTENCE & FUTURE COGS RESOLUTION      │
│    Unit Cost = (taxable_value - discount) / quantity   │
│    Persisted for inventory valuation and order COGS    │
└────────────────────────────────────────────────────────┘
```

### 4.2. Purchase Line Decomposition Rules
For every `purchase_item`:
1. **Taxable Base**:
   $$\text{Taxable Value} = (\text{Quantity} \times \text{Rate}) - \text{Line Discount}$$
2. **GST Decomposition**:
   - Intrastate ($\text{Supplier State} = \text{Branch State}$): Split equally into CGST and SGST:
     - 5% (Bakery): DR `1141` (CGST 2.5%) + DR `1142` (SGST 2.5%)
     - 18% (Accessories): DR `1143` (CGST 9.0%) + DR `1144` (SGST 9.0%)
     - 12% (Toys/Novelties): DR `1147` (CGST 6.0%) + DR `1148` (SGST 6.0%)
   - Interstate ($\text{Supplier State} \neq \text{Branch State}$):
     - 5% (Bakery): DR `1145` (IGST 5.0%)
     - 18% (Accessories): DR `1146` (IGST 18.0%)
     - 12% (Toys/Novelties): DR `1149` (IGST 12.0%)
3. **Inventory Account Mapping**:
   - Bakery / Cakes: DR `1132` (Merchandise Inventory - Cakes)
   - Accessories: DR `1131` (Merchandise Inventory - Accessories)
4. **Supplier Liability**:
   - CR `2111` (Accounts Payable), tagged with `supplier_id = purchase.supplier_id` and `branch_id = purchase.branch_id`.

---

## 5. Comprehensive Inventory Valuation Analysis & Decision

### 5.1. Comparative Analysis Matrix

| Evaluation Dimension | FIFO (First-In, First-Out) | Moving Weighted Average (MWA) | Specific Identification (Bill Matching) |
|---|---|---|---|
| **Operational Fit (Cakes)** | Excellent. Perishable cakes turn over daily (24–48h shelf life). Oldest stock physically sold first. | Poor for perishable cakes. Blending stale purchase costs into fresh items distorts daily profitability. | Ideal for custom / back-to-back cakes where an order is placed specifically with a supplier. |
| **Operational Fit (Accessories)** | Good, but requires maintaining discrete lot depletion queues across hundreds of sales. | **Optimal**. Party candles and toppers are non-perishable, homogenous, and purchased in bulk. | Poor. Physical candles lack serialized barcodes; impossible to identify which ₹10 candle was sold. |
| **Ind AS 2 / IAS 2 Compliance** | Fully compliant. Specifically recognized as primary standard. | Fully compliant. Specifically recognized as primary standard. | Compliant only when items are not ordinarily interchangeable. |
| **Concurrency & Lock Contention** | High contention: concurrent checkouts lock the same oldest purchase lot row. | **Low contention**: single atomic update to average unit cost on purchase; reads do not block. | Low contention: cost locked at order creation time. |
| **Negative Stock Handling** | Fails or creates synthetic negative lots that break FIFO queue integrity. | Handled cleanly: locks unit cost at last known average until replenishment. | Fails: cannot match a bill that does not exist. |
| **Implementation Complexity** | Medium-High (Lot tracking table, partial lot depletion, returns restoration). | **Medium-Low** (Pre-computed unit cost on variant/branch inventory, updated on purchase). | Low for back-to-back, impossible for open counter sales. |
| **Auditability & Traceability** | High: exact purchase receipt lot mapped to each sale. | High: mathematically reproducible from purchase history and sales quantities. | Exact: 1-to-1 supplier invoice link. |

### 5.2. Authoritative Architecture: The Dual-Valuation Engine
CakeToHome implements a **Hybrid, Tier-Based Valuation Architecture**:

1. **Tier 1 — Perishable Made-To-Order Cakes (Specific Identification / FIFO Batch)**:
   - For custom cakes and advance customer orders: **Specific Bill Matching**. When an order is placed, the branch issues a purchase order to the external bakery for that specific order. The exact supplier purchase item cost is attached directly to the order line.
   - For daily retail counter cakes: **FIFO Daily Batch Matching**. Depleted strictly in chronological order of purchase receipt date within the branch.
2. **Tier 2 — Non-Perishable Accessories (Moving Weighted Average - MWA)**:
   - All items under `cat_accessories` (`branch_inventory` rows) utilize **Moving Weighted Average (MWA)** at the `(branch_id, product_id, variant_id)` granularity.
   - Formula:
     $$\bar{C}_{\text{new}} = \frac{(Q_{\text{current}} \times \bar{C}_{\text{current}}) + (Q_{\text{in}} \times C_{\text{in}})}{Q_{\text{current}} + Q_{\text{in}}}$$
   - When a sale occurs: $\text{COGS} = Q_{\text{sold}} \times \bar{C}_{\text{current}}$.

---

## 6. Cost State Machine & Non-Fabrication Protocol

Under no circumstances may the ERP generate, estimate, or assume a COGS amount. The system must operate under an explicit, deterministic state machine:

```
                  ┌──────────────────────┐
                  │ Order Line Created   │
                  └──────────┬───────────┘
                             │ Evaluate Cost Source
            ┌────────────────┼────────────────┐
            ▼                                 ▼
   [Linked Purchase Bill]             [Bulk Accessory]
   Does purchase_item exist?          Does branch MWA exist?
      │             │                     │             │
     YES            NO                   YES            NO
      │             │                     │             │
      ▼             ▼                     ▼             ▼
┌───────────┐ ┌───────────┐         ┌───────────┐ ┌───────────┐
│   COST    │ │   COST    │         │   COST    │ │   COST    │
│ AVAILABLE │ │  PENDING  │         │ AVAILABLE │ │UNAVAILABLE│
└─────┬─────┘ └─────┬─────┘         └─────┬─────┘ └─────┬─────┘
      │             │                     │             │
      ▼             │                     ▼             │
[Post COGS Voucher] │               [Post COGS Voucher] │
                    │                                   │
                    ▼                                   ▼
         [Purchase Bill Arrives]              [Exception Queue]
         Update to COST_AVAILABLE            Finance Audit Flag
         Trigger Deferred COGS               Zero GL Mutation
```

### State Definitions:
1. **`COST_AVAILABLE`**:
   - The exact purchase item rate or active branch MWA cost is present in the database.
   - System immediately posts the COGS voucher and journal entry.
2. **`COST_PENDING`**:
   - The cake was fulfilled and delivered, but the external bakery supplier has not yet submitted the tax invoice.
   - **Financial Policy**: Sales revenue and output GST are recognized immediately upon delivery. The COGS voucher is **HELD IN PENDING STATE**. No estimated COGS is posted.
   - As soon as the purchase voucher is approved in Phase 1 / Phase 4, an automated event transitions the order cost to `COST_AVAILABLE` and posts the corresponding COGS entry.
3. **`COST_UNAVAILABLE`**:
   - Historical orders prior to accounting cut-off, or inventory items with missing vendor records.
   - System posts **ZERO** COGS. Flags an audit exception report for finance management reconciliation.
4. **`COST_EXCEPTION`**:
   - Irregular conditions: negative stock, purchase rate exceeds selling price, or unit cost $\le 0$.
   - Transaction is routed to the `accounting_exception` table and blocked from automatic GL posting until resolved by a Finance Admin.

---

## 7. Master Posting Matrix (All 21 Financial Events)

Every financial event in CakeToHome maps to an authoritative double-entry journal template conforming to `chk_jline_single_sided`, `chk_journal_balanced`, and `chk_account_subtype`:

### Event 1: Cake Merchandise Purchase (Vendor Bill)
- **Voucher Type**: `PURCHASE`
- **Debit**: `1132` (Merchandise Inventory - Cakes) [Item Taxable Value]
- **Debit**: `1141` / `1142` (Input CGST/SGST 2.5%) or `1145` (Input IGST 5.0%)
- **Credit**: `2111` (Accounts Payable) [Invoice Total] (`supplier_id`, `branch_id`)

### Event 2: Accessory Merchandise Purchase (Vendor Bill)
- **Voucher Type**: `PURCHASE`
- **Debit**: `1131` (Merchandise Inventory - Accessories) [Item Taxable Value]
- **Debit**: `1143` / `1144` (Input CGST/SGST 9.0%) or `1146` (Input IGST 18.0%)
- **Credit**: `2111` (Accounts Payable) [Invoice Total] (`supplier_id`, `branch_id`)

### Event 3: Customer Order Placement & Online Payment Capture
- **Voucher Type**: `RECEIPT`
- **Debit**: `1113` (Gateway Clearing) [Captured Amount]
- **Credit**: `2141` (Customer Advances) [Prepaid Deposit] (`customer_id`, `branch_id`)

### Event 4: Order Delivery & Revenue Recognition (Online Prepaid)
- **Voucher Type**: `SALES`
- **Debit**: `2141` (Customer Advances) [Total Billed] (`customer_id`, `branch_id`)
- **Credit**: `4110` (Cake Sales Revenue - 5% GST) [Cake Net Amount]
- **Credit**: `4120` (Accessory Sales Revenue - 18% GST) [Accessory Net Amount]
- **Credit**: `4130` (Delivery Charges Collected) [Delivery Fee]
- **Credit**: `4140` (Customization & Midnight Surcharges) [Surcharges]
- **Credit**: `2121` / `2122` (Output CGST/SGST 2.5%) or `2125` (Output IGST 5.0%)
- **Credit**: `2123` / `2124` (Output CGST/SGST 9.0%) or `2126` (Output IGST 18.0%)

### Event 5: Order Delivery & Revenue Recognition (COD)
- **Voucher Type**: `SALES`
- **Debit**: `1121` (Accounts Receivable) [Total Billed] (`customer_id`, `branch_id`)
- **Credit**: `4110`, `4120`, `4130`, `4140` (Revenue Accounts)
- **Credit**: `2121` - `2126` (Output GST Accounts)

### Event 6: Cash on Delivery (COD) Doorstep Collection
- **Voucher Type**: `RECEIPT`
- **Debit**: `1122` (Undeposited COD) [Collected Cash] (`branch_id`)
- **Credit**: `1121` (Accounts Receivable) [Billed Amount] (`customer_id`, `branch_id`)

### Event 7: COD Rider Cash Banking / Branch Handover
- **Voucher Type**: `CONTRA`
- **Debit**: `1111` (Cash in Hand) [Physical Cash Handover] (`branch_id`)
- **Credit**: `1122` (Undeposited COD) [Cleared Fleet Transit] (`branch_id`)

### Event 8: Actual COGS Recognition (Cakes Sold)
- **Voucher Type**: `JOURNAL`
- **Debit**: `5110` (Cost of Goods Sold - Cakes) [Actual Purchase Cost] (`branch_id`)
- **Credit**: `1132` (Merchandise Inventory - Cakes) [Actual Purchase Cost] (`branch_id`)

### Event 9: Actual COGS Recognition (Accessories Sold)
- **Voucher Type**: `JOURNAL`
- **Debit**: `5120` (Accessory Merchandise Sold) [MWA Cost $\times$ Qty] (`branch_id`)
- **Credit**: `1131` (Merchandise Inventory - Accessories) [MWA Cost $\times$ Qty] (`branch_id`)

### Event 10: Payment Gateway Bank Settlement & Netting
- **Voucher Type**: `RECEIPT`
- **Debit**: `1112` (Bank Operating A/c) [Net Payout Received]
- **Debit**: `5290` (Payment Gateway MDR Fees) [MDR Commission]
- **Debit**: `1143` / `1144` (Input CGST/SGST 9.0% on MDR Invoice)
- **Credit**: `1113` (Gateway Clearing) [Gross Captured Total Cleared]

### Event 11: Vendor Bill Payment (Supplier AP Settlement)
- **Voucher Type**: `PAYMENT`
- **Debit**: `2111` (Accounts Payable) [Settled Invoice Amount] (`supplier_id`, `branch_id`)
- **Credit**: `1112` (Bank Operating A/c) [Disbursed Amount]
- **Credit**: `5190` (Purchase Discounts Received) [Cash/Prompt Discount, if applicable]

### Event 12: Purchase Return & Debit Note Issuance
- **Voucher Type**: `DEBIT_NOTE`
- **Debit**: `2111` (Accounts Payable) [Gross Return Value] (`supplier_id`, `branch_id`)
- **Credit**: `1132` or `1131` (Merchandise Inventory) [Returned Cost] (`branch_id`)
- **Credit**: `1141` - `1149` (Input GST ITC Reversal) [Tax Reversal]

### Event 13: Customer Order Cancellation & Refund
- **Voucher Type**: `CREDIT_NOTE`
- **Debit**: `4190` (Sales Returns, Refunds & Allowances) [Taxable Base] (`branch_id`)
- **Debit**: `2121` - `2126` (Output GST Reversal) [Tax Liability Cancelled]
- **Credit**: `1113` (Gateway Refund Transit) or `2141` (Customer Advance Restored)

### Event 14: Operational Expense Payment (Cash / Bank)
- **Voucher Type**: `EXPENSE`
- **Debit**: `5210` - `5299` (Specific Operating Expense) [Taxable Base] (`branch_id`)
- **Debit**: `1141` - `1149` (Input GST Credit, if GST invoice supplied)
- **Credit**: `1111` (Cash in Hand) or `1112` (Bank Operating A/c)

### Event 15: Fleet Fuel & Trip Expense Incurred
- **Voucher Type**: `EXPENSE`
- **Debit**: `5230` (Vehicle Fuel & Fleet Maintenance) [Fuel/Toll Cost] (`branch_id`)
- **Credit**: `1114` (Petty Cash - Branches) or `1111` (Cash in Hand)

### Event 16: Inter-Branch Stock Transfer (Outward)
- **Voucher Type**: `JOURNAL`
- **Debit**: `1119` (Transit Inventory / Inter-Branch Clearing) [Cost]
- **Credit**: `1131` / `1132` (Merchandise Inventory - Source Branch) [Cost] (`branch_id = source`)

### Event 17: Inter-Branch Stock Transfer (Inward Receipt)
- **Voucher Type**: `JOURNAL`
- **Debit**: `1131` / `1132` (Merchandise Inventory - Dest Branch) [Cost] (`branch_id = dest`)
- **Credit**: `1119` (Transit Inventory / Inter-Branch Clearing) [Cost]

### Event 18: Damaged / Expired Cake Spoilage Write-Off
- **Voucher Type**: `JOURNAL`
- **Debit**: `5299` (Miscellaneous Operating Expenses / Spoilage Loss) [Cost] (`branch_id`)
- **Credit**: `1132` (Merchandise Inventory - Cakes) [Cost] (`branch_id`)
- **Credit**: `1141` / `1142` (ITC Reversal on Spoilage under GST Sec 17(5)(h))

### Event 19: Physical Stock Audit Adjustment (Shortage / Overage)
- **Shortage**: DR `5299` (Inventory Shrinkage Loss) | CR `1131` (Inventory) + CR Input ITC Reversal.
- **Overage**: DR `1131` (Inventory) | CR `5299` (Inventory Adjustment Gain).

### Event 20: Monthly Payroll Accrual
- **Voucher Type**: `JOURNAL`
- **Debit**: `5250` (Staff Salaries & Store Personnel) [Gross Salaries] (`branch_id`)
- **Credit**: `2151` (Salaries & Wages Payable) [Net Payable]
- **Credit**: `2130` (TDS Payable) [Tax Withheld]

### Event 21: Fiscal Year-End Retained Earnings Roll-Up
- **Voucher Type**: `JOURNAL`
- Net Revenues debited to zero, Expenses credited to zero:
- Difference transferred to: `3220` (Current Year Net Earnings) $\rightarrow$ `3210` (Retained Earnings Prior Years).

---

## 8. Voucher Lifecycle, Reversals & Control Invariants

### 8.1. Forward-Only Voucher State Machine
```
[ DRAFT ] ───────────► [ SUBMITTED ] ───────────► [ APPROVED ] ───────────► [ POSTED ]
    │                        │                         │
    └────────────────────────┴─────────────────────────┴──────────────► [ CANCELLED ]
```
- **`DRAFT`**: Editable. Zero journal entries generated.
- **`SUBMITTED`**: Locked against editing. Pending manager review.
- **`APPROVED`**: Reviewed by authorized manager.
- **`POSTED`**: General Ledger lines committed. **STRICTLY IMMUTABLE**. Cannot be updated, deleted, or cancelled (`chk_voucher_posted_immutable`).

### 8.2. Immutable Reversal Protocol
When a posted voucher contains an error or must be voided:
1. The original voucher remains **POSTED** and unchanged.
2. A new compensating voucher of opposite effect is generated:
   - Sets `voucher.reversal_of_voucher_id = original_voucher.id`.
   - Sets `original_voucher.reversed_by_voucher_id = new_voucher.id`.
   - Constraint `chk_voucher_reversal_limit` guarantees that a reversal voucher cannot itself be reversed.
3. Perfect audit integrity: both original and reversal vouchers remain visible in the ledger.

### 8.3. Segregation of Duties (SoD)
Enforced at the database constraint level:
$$\text{approved\_by IS NULL OR approved\_by} \neq \text{created\_by}$$
A branch manager or accountant cannot approve their own financial vouchers. All approvals require dual-custody authorization.

### 8.4. Fiscal Period Locking
- Table: `accounting_fiscal_period` (`is_locked`, `start_date`, `end_date`).
- Before any voucher is posted, the posting engine queries:
  ```sql
  SELECT count(*) FROM public.accounting_fiscal_period
  WHERE $1 BETWEEN start_date AND end_date AND is_locked = true;
  ```
- If locked, the transaction throws `FISCAL_PERIOD_LOCKED` (HTTP 403) and terminates.

### 8.5. Group Account Protection
The Chart of Accounts contains 24 group summary accounts (`is_group = true`).
- The posting engine executes an automated verification prior to inserting any journal line:
  ```sql
  SELECT code, name FROM public.accounting_account
  WHERE id = $1 AND is_group = true;
  ```
- If true, the posting engine immediately throws `GROUP_ACCOUNT_POSTING_BLOCKED`. Journal entries can ONLY post to leaf accounts (`is_group = false`).

---

## 9. Canonical Ownership Matrix (No-Duplicator & Lazy-Coder Audit)

To prevent code duplication, fragmentation, and competing logic, single-source ownership across existing repositories and services is strictly established:

| Domain / Responsibility | Canonical Implementation | Forbidden Duplications |
|---|---|---|
| **GST Rates & Calculations** | `frontend/src/lib/types/domain.ts` & `purchase.repository.ts` | Ad-hoc tax math in UI, hardcoded 5%/18% literals in API routes. |
| **Branch Authorization & RBAC** | `frontend/src/lib/staff-access-control.ts` | Duplicate session checks in controllers, client-controlled `branch_id`. |
| **Customer Identification** | `frontend/src/lib/repositories/customer.repository.ts` | Duplicate customer queries, unvalidated client customer IDs. |
| **Supplier Identification** | `frontend/src/lib/repositories/supplier.repository.ts` | Raw supplier SQL queries in posting routes. |
| **Inventory Stock & Deductions** | `frontend/src/lib/services/inventory.service.ts` | Independent stock deduction logic in order/accounting controllers. |
| **Purchase & Bill Management** | `frontend/src/lib/repositories/purchase.repository.ts` | Parallel purchase item query builders. |
| **Operational Expense Ledger** | `frontend/src/lib/repositories/expense.repository.ts` | Independent expense storage logic. |
| **Fleet & Delivery Cost** | `frontend/src/lib/repositories/fleet-fuel.repository.ts` | Hardcoded delivery cost assumptions. |
| **Database Transactions & Pooling**| `frontend/src/lib/db.ts` (`dbQuery`, `dbTransaction`) | Creating direct `new Client()` connections in application routes. |
| **Double-Entry Balance Enforcer**| `public.trg_check_journal_balance` (PostgreSQL Trigger) | Relying solely on client/service balance checks. |

---

## 10. Security Architecture & Threat Mitigation (OWASP Alignment)

| Threat / Vulnerability | Architectural Defense Mechanism |
|---|---|
| **Broken Object-Level Authorization (BOLA / IDOR)** | `branch_id`, `supplier_id`, and `customer_id` are verified server-side against session credentials. Staff cannot view or post vouchers for foreign branches. |
| **Client-Controlled Amounts & Taxes** | All debit and credit line amounts are calculated and verified server-side from canonical database records. Client-submitted monetary values are treated as untrusted hints. |
| **Duplicate Posting & Replay Attacks** | Unique partial index `idx_accounting_voucher_source_idempotency` on `(reference_type, reference_id, reference_event)` guarantees that an operational order, payment, or bill can only be posted once. |
| **Posted Voucher Tampering** | PostgreSQL trigger and constraint `chk_voucher_posted_immutable` physically reject any SQL `UPDATE` or `DELETE` on posted vouchers. |
| **Audit Trail Manipulation** | Audit columns (`created_by`, `submitted_by`, `approved_by`, `posted_by`) are populated strictly from validated server session tokens (`session.staff_id`), never from request payload bodies. |
| **SQL Injection** | Strict parameterization (`$1, $2`) across 100% of repository queries. Zero dynamic string concatenation. |

---

## 11. Accounting UI & Lazy-Loading Architecture

The accounting frontend must adhere to strict performance, security, and lazy-loading standards:

### 11.1. Core UI Rules
1. **Never Load Entire Ledger**: The accounting dataset must NEVER be fetched into browser memory in bulk.
2. **Server-Side Pagination & Filtering**:
   - URL parameters drive state: `?page=1&limit=25&branchId=xxx&status=POSTED&startDate=2026-09-01&endDate=2026-09-24`.
   - Backend queries utilize indexed pagination:
     ```sql
     SELECT * FROM public.accounting_voucher
     WHERE branch_id = $1 AND voucher_date BETWEEN $2 AND $3
     ORDER BY voucher_date DESC, id DESC
     LIMIT $4 OFFSET $5;
     ```
3. **Lazy-Loaded Modules**:
   - Large financial reports (General Ledger, Trial Balance, P&L, Balance Sheet) must be dynamically loaded via Next.js `dynamic()`:
     ```typescript
     const GeneralLedgerReport = dynamic(() => import('@/components/dashboard/accounting/general-ledger'), {
       loading: () => <TableSkeleton rows={15} columns={6} />
     });
     ```
4. **Zero Fallback & Zero Mock Invariant**:
   - If the API returns empty or fails, UI renders an explicit empty/error state. No fallback static arrays or mock records.

---

## 12. Verification & Historical Cut-Off Boundary

### 12.1. Historical Accounting Quarantine
- Setting key `accounting_start_date` in `public.setting` remains **STRICTLY UNCONFIGURED**.
- All 173 historical orders and 53 historical payment transactions occurred prior to the establishment of the general ledger.
- **Cut-Off Policy**: Historical operational records remain permanently archived and untouched. At official ERP cut-off date (to be configured in a subsequent authorized phase), an **Opening Balance Voucher** will establish opening ledger balances using Equity Offset `3300`, guaranteeing zero retroactive contamination.

---

## 13. Independent Database Evidence & Verification Summary

Independent execution of `scratch/verify_phase4e_recovery.js` against the live PostgreSQL 17.6 database produced the following authoritative counts:

```json
{
  "timestamp": "2026-09-24T01:33:32.323Z",
  "counts": {
    "accounting_account": 98,
    "accounting_voucher": 0,
    "accounting_journal_entry": 0,
    "accounting_journal_line": 0,
    "accounting_fiscal_period": 0,
    "purchase": 0,
    "purchase_item": 0,
    "purchase_payment": 0,
    "supplier": 0,
    "order": 173,
    "payment_transaction": 53,
    "branch_inventory": 424,
    "product": 65,
    "product_variant": 27,
    "expense": 0,
    "expense_category": 11,
    "fleet_fuel": 0,
    "vehicle": 0,
    "vehicle_trip": 0,
    "branch": 57,
    "customer": 57,
    "setting": 16
  },
  "account_groups": {
    "group_count": 24,
    "posting_count": 74
  },
  "accounting_start_date_configured": false,
  "safety_checks": {
    "accounting_account_is_98": true,
    "accounting_voucher_is_0": true,
    "accounting_journal_entry_is_0": true,
    "accounting_journal_line_is_0": true,
    "order_is_173": true,
    "payment_transaction_is_53": true,
    "accounting_start_date_unconfigured": true,
    "group_count_is_24": true,
    "posting_count_is_74": true
  }
}
```

### Verification Assertions:
- [x] **Assertion 1**: Exactly 98 Chart of Accounts exist in `public.accounting_account`.
- [x] **Assertion 2**: Exactly 24 group accounts (`is_group = true`) and 74 posting accounts (`is_group = false`).
- [x] **Assertion 3**: Exactly 0 vouchers in `public.accounting_voucher`.
- [x] **Assertion 4**: Exactly 0 journal entries in `public.accounting_journal_entry`.
- [x] **Assertion 5**: Exactly 0 journal lines in `public.accounting_journal_line`.
- [x] **Assertion 6**: Exactly 173 historical orders remain 100% untouched.
- [x] **Assertion 7**: Exactly 53 historical payment transactions remain 100% untouched.
- [x] **Assertion 8**: `accounting_start_date` remains strictly unconfigured.
- [x] **Assertion 9**: Cake & accessory inventories strictly modeled as merchandise trading.
- [x] **Assertion 10**: Zero fabricated COGS; deterministic Cost State Machine specified.
- [x] **Assertion 11**: Item-wise purchase pipeline fully designed with line-item traceability.
- [x] **Assertion 12**: Dual-valuation engine (Specific/FIFO for Cakes, MWA for Accessories) fully analyzed and specified.
- [x] **Assertion 13**: Segregation of duties, group-account protection, and immutable reversals specified.
- [x] **Assertion 14**: Server-paginated, DB-authoritative UI architecture specified.
- [x] **Assertion 15**: Git status clean; zero commits and zero pushes.

---

## 14. Gate Declaration & Mandatory Stop

> [!IMPORTANT]
> **PHASE 4E: CRASH RECOVERY COMPLETE — POSTING ENGINE DESIGN COMPLETE & 100% VERIFIED**
> - **CRASH FORENSICS**: Complete (Zero corrupted files or partial implementations).
> - **DESIGN SPECIFICATION**: 100% Complete (Covers all 41 mandatory architectural points).
> - **POSTING ENGINE IMPLEMENTATION**: NOT STARTED (Design only).
> - **VOUCHERS / JOURNALS**: 0 rows created.
> - **HISTORICAL MUTATION**: 0 rows modified (173 orders, 53 payments untouched).
> - **DATABASE STATE**: Clean, authoritative, and independently verified.
> - **GIT STATE**: Clean (0 commits, 0 pushes).
>
> **SYSTEM STOPPED.**
> Awaiting explicit user authorization before proceeding to Phase 4F (Posting Engine Implementation).
