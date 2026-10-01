# Phase 5A.6 Substep 5.4 — UI + Manager Operations Forensic & Design Gate
**CakeToHome ERP — Distributed Branch Operations with Centralized Financial Authority**
**Status**: 🔒 LOCKED & CORRECTED DESIGN GATE

---

## 1. Executive Summary & Foundational Principle

### 1.1 Objective of this Design Gate
Before writing UI components for **Phase 5A.6 Substep 5.4**, this forensic and design gate establishes the comprehensive architecture uniting **Branch Operations** with the **Enterprise Accounting Engine**.

Substep 5.4 is **not** merely the implementation of three isolated financial reporting panels; it is the visual and operational unification of the CakeToHome ERP workflow, ensuring that daily shop-floor entries directly feed the accounting system without bypassing financial controls.

### 1.2 Core Architectural Principle: Distributed Operations, Centralized Financial Authority
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          BRANCH OPERATIONS (SHOP LEVEL)                          │
│                                                                                 │
│   Manager / Cashier / Chef enters operational events & source documents:        │
│   • In-Store Sales / KOT     • Physical GRN (Goods Receipt)   • Damaged Stock   │
│   • Supplier Purchase Order  • Petty Cash Expense Voucher     • Day Cash Count  │
│   • Rider COD Remittance     • Bank Deposit Slip Preparation  • Stock Counts    │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Source Documents / Submissions
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     CENTRAL ACCOUNTING ENGINE (ENTERPRISE)                      │
│                                                                                 │
│   Super Admin / Financial Controller governs accounting, controls & reports:    │
│   • Approval Queues          • Review → Validate → Approve    • Canonical Post  │
│   • General Ledger (Dr/Cr)   • AP / AR Sub-Ledgers            • Bank Recon      │
│   • Period & Year-End Close  • Retained Earnings Roll-Forward • Financial Stmts │
└─────────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **The Manager Panel does NOT create arbitrary accounting journal entries.**
> The Branch Manager enters real-world business events and source documents (orders, goods physically received, expenses claimed, cash collected). The central accounting engine (`PostingService`) remains strictly responsible for the financial consequences (double-entry vouchers, GL debits/credits, tax liability/input, inventory valuation, and period closes).

---

## 2. Mandatory Accounting & ERP Consistency Rules (Locked Invariants)

The following 8 corrections are strictly locked into the architecture before UI implementation:

1. **GRN does NOT imply accounting posting**:
   The manager records physical receipt of goods (ordered vs received quantity). The existing purchase accounting flow remains:
   `Purchase → Approval → Voucher → Accounting Posting`.
   The UI must not create any impression that completing a GRN posts inventory/AP/GST to the General Ledger.
2. **Authoritative Chart of Accounts (CoA) for Inventory (No 1135)**:
   Our locked Chart of Accounts strictly uses:
   - `1131` Merchandise Inventory – Accessories
   - `1132` Merchandise Inventory – Cakes
   - `1133` Packaging Supplies Stock
   Account `1135` is NOT an established inventory account. The manager UI must consume the actual merchandise type/account mapping from the backend rather than hardcoding accounts.
3. **No Casual 2119 Accruals**:
   The established AP control is `2111 Accounts Payable`. Expense accounting has not yet established a generic `2119` accrual workflow. The manager UI submits expenses as operational claims without assuming a particular GL credit account.
4. **Spoilage / Write-Off Accounting is Deferred**:
   The UI supports an operational stock-damage/spoilage reporting workflow (units, photo, reason code), but it must NOT claim that it posts `Dr 5190 / Cr Inventory` until a dedicated, verified accounting service is implemented.
5. **Cash Opening Float is Operational**:
   The manager records the physical cash drawer opening count for daily accountability. It does NOT create or alter Account `1111` opening balances directly.
6. **COD Shortage Handling is Strictly Fail-Closed**:
   The manager records discrepancy notes and explanations if cash presented does not equal authoritative custody. The UI must NOT invent a shortage journal or automatically write to an expense/loss account.
7. **Central Accounting: Review → Validate → Approve → Post (No "One-Click Post")**:
   Central accounting enforces strict Segregation of Duties (SoD):
   `PREPARER ≠ APPROVER ≠ POSTER`.
   The UI must preserve distinct review, validation, approval, and posting steps where required by the backend.
8. **Module B is NOT a Parallel ERP**:
   The Branch Manager Panel orchestrates existing canonical APIs and services (`PurchaseService`, `ExpenseService`, `OrderService`, `CodCollectionService`, `BankDepositSlipService`, `InventoryService`). Zero parallel business logic or calculations are created in the frontend.

---

## 3. Workflow Ownership Matrix (Permanent Architectural Artifact)

| Workflow | Branch Manager | Accounting / Finance | Enterprise / Admin |
| :--- | :--- | :--- | :--- |
| **Purchase Entry** | Create draft, enter line items | Approve & Post to General Ledger | Configure suppliers & terms |
| **Goods Receipt Note (GRN)** | Record physical receipt (ordered vs received) | Financial validation & voucher posting | Configure procurement policies |
| **Expense Claims** | Create & submit petty cash claim | Approve & Post to General Ledger | Configure expense categories & limits |
| **Sales & Billing** | Operate counter POS, print KOT, fulfill | Financial voucher posting & COGS | Configure products, pricing, discounts |
| **COD Collection** | Collect from riders, confirm settlement | Financial settlement & GL clearing | Monitor multi-branch remittance |
| **Cash Drawer** | Open float count, day-end cash closing | Reconcile against Account 1111 | Monitor cash limits & discrepancies |
| **Bank Deposits** | Prepare deposit slip & denomination count | Approve, Post transit voucher, Reconcile | Monitor bank feeds & settlements |
| **Inventory Count** | Perform physical counts & log variance | Review financial impact & valuation | Configure stock items & reorder points |
| **Stock Damage** | Report damaged/expired stock & reasons | Accounting treatment when implemented | Configure wastage & disposal policies |
| **Supplier Masters** | View supplier details & open invoices | Financial oversight & AP aging | Maintain vendor contracts & tax info |
| **Chart of Accounts** | No access | Maintain & control sub-ledgers | Enterprise authority |
| **Fiscal Periods** | No access | Lock, close, and reopen periods | Enterprise oversight |
| **Year-End Close** | No access | Execute nominal zeroing & close vouchers| Enterprise oversight |
| **Financial Reports** | Branch operational views (Sales, Cash, Stock)| Full accounting reports (TB, P&L, BS, RE) | Enterprise executive dashboards |

---

## 4. Daily Operations: What a Branch Manager Enters & Where Each Entry Flows

### 4.1 Morning Opening & Cash Drawer Float
- **What Manager Enters**: Physical cash count present in drawer at opening (by denomination).
- **Where It Flows (Operational)**: Recorded in `branch_cash_drawer_session` (`status = 'OPEN'`).
- **Where It Flows (Accounting)**: Operational accountability only. Zero direct GL mutation to Account `1111`.

### 4.2 In-Store Billing / Counter POS & Online Order Fulfillment
- **What Manager Enters**: Walk-in sale details, cake customization, payment mode (Cash/UPI/Card). Accepts online orders, prints KOT, marks packed/ready for dispatch.
- **Where It Flows (Operational)**: Saved to `orders` and `order_items`. Physical stock reserved on accept, deducted on mark ready.
- **Where It Flows (Accounting)**: `SalesPostingService` generates canonical Sales Voucher:
  - Dr `1121` Accounts Receivable (or `1113` Gateway Clearing / `1122` Undeposited COD)
  - Cr `4110` Cake Sales Revenue
  - Cr `2131` CGST Output / `2132` SGST Output
  - COGS Voucher: Dr `5110` COGS, Cr `1132` Merchandise Inventory – Cakes / `1131` Merchandise Inventory – Accessories.

### 4.3 Supplier Purchases & Goods Receipt Notes (GRN)
- **What Manager Enters**: Selects approved supplier, enters bill details, line items (raw materials, packaging, accessories). Records physical GRN received quantity vs invoice quantity. Attaches bill photo. Clicks "Submit for Approval".
- **Where It Flows (Operational)**: Saved in `purchases` (`status = 'SUBMITTED'`). Physical stock in `branch_inventory` increments based on physical receipt.
- **Where It Flows (Accounting)**: Lands in Finance **Purchase Approval Queue**. Finance reviews invoice, validates GST and GRN receipt, approves, and posts:
  - Dr `1131`/`1132`/`1133` (Merchandise / Packaging Inventory)
  - Dr `1141`/`1142` (Input Tax Credits)
  - Cr `2111` Accounts Payable (Supplier Sub-Ledger).
  - *No GL entries are created upon GRN entry itself.*

### 4.4 Store & Petty Cash Expenses
- **What Manager Enters**: Expense category, amount, payee, bill attachment. Submits for approval.
- **Where It Flows (Operational)**: Saved in `expenses` with `branch_id` (`status = 'SUBMITTED'`).
- **Where It Flows (Accounting)**: Lands in Finance **Expense Approval Queue**. Finance audits receipt and posts:
  - Dr `5xxx` Expense Account
  - Cr `1111` Cash in Hand (or payment method).

### 4.5 Delivery Rider Dispatch & COD Remittance Reconciliation
- **What Manager Enters**: Assigns order to rider. At shift end, counts cash presented by rider against system custody (`sum(delivered_cod)`).
- **Where It Flows (Operational)**: Freezes immutable `cod_custody_event` on orders; clears rider transit custody.
- **Where It Flows (Accounting)**: If cash === custody, triggers `CustomerReceiptService.postCodShiftSettlement`:
  - Dr `1111` Cash in Hand (Branch Drawer)
  - Cr `1122` Undeposited COD.
  - *If discrepancy occurs: System fails closed. Discrepancy logged for supervisor review.*

### 4.6 Inventory Count & Damage Reporting
- **What Manager Enters**: Inputs periodic physical stock count. Inputs damaged/expired units with mandatory reason code (`EXPIRED`, `TRANSIT_DAMAGE`, `SAMPLING`) and photo.
- **Where It Flows (Operational)**: Updates `branch_inventory`; logs damage report.
- **Where It Flows (Accounting)**: Operational report only. Spoilage accounting will be integrated when the backend accounting service is implemented.

### 4.7 Day-End Cash Drawer Closing & Bank Deposit Preparation
- **What Manager Enters**: Physical drawer denomination count. Reconciles: `Expected = Float + Cash Sales + COD - Payouts`. Prepares Bank Deposit Slip (`status = 'SUBMITTED'`).
- **Where It Flows (Operational)**: Closes drawer session in `branch_cash_drawer_session`. Creates `bank_deposit_slip`.
- **Where It Flows (Accounting)**: Supervisor approves physical cash handover. Finance posts:
  - Dr `1118` Deposit in Transit
  - Cr `1111` Cash in Hand.
  - Reconciled to Bank `1112` upon statement matching.

---

## 5. Substep 5.4 Phased Implementation Boundary

### Phase 1: Module A — Accounting Reporting UI (CURRENT FOCUS)
- **Scope**: Multi-Year Accounting Reporting views consuming verified Substep 5.3 endpoints:
  1. `GET /api/v1/admin/accounting/reports/retained-earnings-rollforward`
  2. `GET /api/v1/admin/accounting/reports/fiscal-year-summary`
  3. `GET /api/v1/admin/accounting/reports/comparative-pnl` (and alias `/comparative-profit-loss`)
- **Nature**: Strictly read-only.
- **Constraint**: Zero accounting calculations in React; renders structured server outputs directly.
- **Integration**: Placed within the Accounting/Finance reporting suite accessible from Super Admin / Accounting.

### Phase 2: Module B — Branch Manager Daily Operations Panel
- **Scope**: Reorganizes `/dashboard/shop` into the 7 standard operational tabs:
  `/shop`
   ├── `Dashboard`: KPIs, cash position, pending tasks, stock alerts
   ├── `Orders & Fulfillment`: Order cards, KOT print, fulfillment, dispatch
   ├── `Purchases & GRN`: Supplier selection, PO entry, physical GRN checklist, submit
   ├── `Expenses`: Petty cash claim entry, bill attachment, submit
   ├── `Cash & Teller`: Opening float, COD remittance verification, Bank Deposit Slip prep
   ├── `Inventory`: Physical stock view, periodic count entry, damage reporting
   └── `Branch Reports`: Daily sales summary, cash closing log, stock movement
- **Constraint**: Scoped strictly to authenticated manager's branch (`branch_id`). Reuses existing canonical APIs. Creates source documents only—never GL entries.

### Phase 3: Module C — Accounting Work Queue
- **Scope**: Review, validation, approval, and canonical posting for submitted items:
  - Purchase Approval Queue
  - Expense Approval Queue
  - Bank Deposit Approval Queue
  - Gateway Settlement
- **Constraint**: Enforces `PREPARER ≠ APPROVER ≠ POSTER`.
