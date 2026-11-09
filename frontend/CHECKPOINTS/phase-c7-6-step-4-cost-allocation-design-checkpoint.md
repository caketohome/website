# PHASE C7.6 STEP 4 — COST ALLOCATION ENGINE & RULES
## FORENSIC & DESIGN LOCK CHECKPOINT

- **Date / Time**: 2026-10-09T07:28:00+05:30
- **Status**: 🔒 **FORENSIC & DESIGN LOCK COMPLETE — ZERO CODE MODIFICATIONS / ZERO MIGRATIONS / ZERO GIT COMMITS / ZERO PUSHES**
- **System**: CakeToHome ERP
- **Phase**: C7.6 — Cost Centre Accounting
- **Step**: Step 4 — Cost Allocation Engine & Rules Forensic & Design Lock

---

### 1. Skill Inventory Report
In compliance with mandatory workflow instructions, the available specialized skills were audited:
- ✅ `smart-coder`: Available (`C:\Users\alexc\.gemini\config\skills\smart-coder\SKILL.md`) — Enforcing 5-step lifecycle, boundary preservation, root-cause diagnostics, and type safety.
- ✅ `lazy-coder`: Available (`C:\Users\alexc\.gemini\config\skills\lazy-coder\SKILL.md`) — Enforcing minimal reliable complexity, zero duplicate abstractions, maximum reuse of existing repositories.
- ✅ PostgreSQL / Database (`postgresql-and-supabase`): Available (`C:\Users\alexc\.gemini\config\skills\postgresql-and-supabase\SKILL.md`) — Parameterized queries, transactional boundaries, schema normalization, index efficiency.
- ✅ Security & RBAC (`security-auditing-and-owasp`, `security-audit`): Available — Maker-checker segregation of duties, BOLA branch isolation, permission enforcement.
- ✅ Architecture (`clean-architecture`): Available — Hexagonal boundaries, decoupling domain calculation engine from persistence repositories and HTTP routes.
- ✅ Testing & QA (`playwright-and-qa-automation`): Available — Multi-tier regression verification, E2E browser automation.
- ℹ️ `accounting/ERP`: There is no dedicated standalone skill titled `accounting-and-erp` in the workspace skill list. Double-entry bookkeeping, GAAP/Ind AS cost allocation mechanics, largest-remainder rounding, and CakeToHome posting repository invariants are applied authoritatively from domain knowledge and live PostgreSQL evidence.

---

### 2. Frozen Baseline Confirmation (Live PostgreSQL Verification)
Direct read-only PostgreSQL queries against the live database established the authoritative baseline:
- **Chart of Accounts Invariant**: Exactly **100 accounts** in `public.accounting_account` (0 added, 0 modified, 0 deleted).
  - All 100 accounts have `is_system = true`, `is_active = true`, `deleted_at IS NULL`.
  - 24 summary group accounts (`is_group = true`).
  - 76 operational leaf accounts (`is_group = false`).
- **Trial Balance Invariant**: Total Dr **₹3,380.00** = Total Cr **₹3,380.00**, Diff = **₹0.0000** (Pristine, 100% balanced).
- **Accounting Vouchers Baseline**: Exactly **6 vouchers** in `public.accounting_voucher`:
  - 3 `EXPENSE` (`POSTED`): Total ₹1,380.00
  - 2 `JOURNAL` (`POSTED`): Total ₹2,000.00
  - 1 `SALES` (`SUBMITTED`): Pre-posting draft
  - Vouchers with `cost_centre_id IS NOT NULL`: Exactly **0** (100% NULL historical data preserved).
- **Journal Entries Baseline**: Exactly **4 entries** in `public.accounting_journal_entry` (0 reversed).
- **Journal Lines Baseline**: Exactly **10 lines** in `public.accounting_journal_line`:
  - Lines with `cost_centre_id IS NOT NULL`: Exactly **0** (100% NULL historical data preserved).
- **Cost Centre Master Baseline**: Exactly **0 rows** in `public.cost_centre` (zero residual test fixtures).
- **Fiscal Periods Baseline**: 1 period configured in `public.accounting_fiscal_period`:
  - `FY2026-27` `October 2026` (`2026-09-30` to `2026-10-30`, `is_locked = false`).
- **Predecessor Milestones**: All predecessor regression suites pass 100% green (C4.1 99/99, C5 40/40, C6.1 51/51, C7.2 32/32, C7.3 55/55, C7.4 62/62, C7.5 60/60, C7.6 Step 1 24/24, C7.6 Step 2 17/17, C7.6 Step 3 16/16).
- **TypeScript Compiler**: 0 errors, 0 warnings (`tsc --noEmit` exit code 0).
- **Git Working Tree**: Clean of commits/pushes (Strict stop protocol observed).

---

### 3. Forensic Analysis & Answers to 10 Forensic Questions

#### Q1: Which existing expense and revenue accounts can carry cost-centre dimensions under Step 3 governance?
- **Balance Sheet Accounts (`1xxx`, `2xxx`, `3xxx`)**: All 66 accounts (7 Assets groups + 27 Assets leaves + 7 Liab groups + 17 Liab leaves + 3 Equity groups + 5 Equity leaves) are strictly **`PROHIBITED`**.
  - Direct posting with a `cost_centre_id` is blocked with domain error `COST_CENTRE_PROHIBITED`.
- **Summary Group Accounts (`is_group = true`)**: All 24 accounts across all classes are strictly **`PROHIBITED`** from direct posting with domain error `ACCOUNT_GROUP_NON_POSTABLE`.
- **Operational Accounts (`4xxx` Revenue, `5xxx` Expenses)**: Exactly **27 leaf accounts** are governed as **`OPTIONAL`**:
  - **7 Revenue Leaf Accounts (`4xxx`)**: `4110` (Cake Sales 5%), `4120` (Accessory Sales 18%), `4130` (Delivery Collected), `4140` (Customization/Surcharge), `4190` (Sales Returns), `4210` (Interest Income), `4220` (Scrap Sales).
  - **20 Expense Leaf Accounts (`5xxx`)**:
    - **5 COGS Accounts (`51xx`)**: `5110` (COGS Cakes), `5120` (Accessory Sold), `5130` (Packaging Consumed), `5140` (Kitchen Direct Labour), `5190` (Purchase Discounts).
    - **12 Operating Expense Accounts (`52xx`)**: `5210` (Store & Kitchen Rent), `5220` (Electricity & Utilities), `5230` (Vehicle Fuel & Maintenance), `5240` (Freight Inward), `5250` (Staff Salaries & Store Personnel), `5260` (Marketing & Promotion), `5270` (Repairs & Maintenance), `5280` (Software & Tech Infrastructure), `5290` (Payment Gateway MDR), `5295` (Cash Rounding), `5296` (Cash Over/Short), `5299` (Misc Operating Expenses).
    - **3 Financial Expense Accounts (`53xx`)**: `5310` (Bank Charges), `5320` (Loan Interest), `5330` (Depreciation & Amortization).
- **Allocation Scope**: Cost allocation applies specifically to operating overheads and shared expenses in the **`52xx`** and **`53xx`** ranges (and central packaging/labor in `51xx` if pooled). Accounts `5295` and `5296` are strictly prohibited from absorbing allocation rounding variances.

#### Q2: Which posting paths currently populate cost-centre IDs, and which leave them NULL?
- **Populates `cost_centre_id`**:
  - `ManualJournalService`: Supports line-level assignment and voucher-level inheritance onto operational lines (`postToGL`).
- **Leaves `cost_centre_id` as `NULL`**:
  - `PostingService` (C4F canonical lifecycle)
  - `ExpensePostingService` (C5 employee/supplier expense claims)
  - `PurchasePostingService` (C4F inventory purchasing & 3-way matching)
  - `SalesPostingService` (C4F POS & online store revenue recognition)
  - `PettyCashService` (C7.5 branch cash imprest replenishment and local claims)
  - `CustomerReceiptService` & `BillsReceivableService` (C7.4 AR settlement)
  - `BillsPayableService` (C7.2 AP settlement)
  - `BankDepositSlipService` & `GatewaySettlementService` (C4F banking)
  - `PeriodCloseService` (C5A retained earnings rollforward)

#### Q3: How do existing P&L, general-ledger, and trial-balance reports treat cost centres?
- Existing reporting modules (`profit-loss.service.ts`, `general-ledger.service.ts`, `report.repository.ts`, `balance-sheet.service.ts`) execute queries aggregating `accounting_journal_line` without filtering or grouping by `cost_centre_id`.
- Entity-wide financial statements are completely indifferent to cost-centre attribution:
  - An allocation journal entry credits the source expense line and debits destination expense lines by equal total amounts.
  - Total debits equal total credits; net enterprise expense change is ₹0.00.
  - Entity-wide Trial Balance, P&L, and Balance Sheet remain 100% mathematically invariant.

#### Q4: Does the existing schema support allocation runs, rule versions, traceability, etc.?
- **NO**. The database has zero tables for cost allocation.
- Existing tables containing 'allocat' are restricted to AR/AP subledgers (`customer_receipt_allocation`, `purchase_payment_allocation`).
- There are no tables for allocation rules, rule targets, allocation runs, or source-line traceability. A dedicated schema must be created.

#### Q5: Which expenses are directly attributable and which genuinely require allocation?
- **Directly Attributable Expenses (No Allocation Required)**:
  - Local branch rent (`5210`) paid directly for an operating branch lease.
  - Branch chef and store personnel wages (`5140`, `5250`) assigned to a specific branch till.
  - Local branch vehicle fuel and repairs (`5230`, `5270`).
  - Branch petty cash disbursements and teller drawer variances (`5295`, `5296`).
  *These are attributed directly to the branch cost centre at entry time.*
- **Shared / Indirect Expenses (Genuinely Requiring Allocation)**:
  - Corporate Headquarters Rent & Central Facility Leases (`5210`) pooled at `CC-HO`.
  - Enterprise Software, Cloud Hosting (AWS), and IT Infrastructure (`5280`) pooled at `CC-TECH` or `CC-HO`.
  - National Brand Advertising & Digital Marketing Campaigns (`5260`) pooled at `CC-MKTG`.
  - Central Logistics, Inward Freight, and Fleet Management Overhead (`5240`, `5230`) pooled at `CC-LOGISTICS`.
  - Corporate Executive, HR, Legal, and Accounting Salaries (`5250`) pooled at `CC-HO`.
  - Shared Bakery Machinery and Central Kitchen Depreciation (`5330`) pooled at `CC-KITCHEN-CENTRAL`.

#### Q6: What allocation bases can be supported by verified source data?
The codebase and database support distinct candidate allocation bases. As mandated by project rules, we do not silently choose an allocation basis. The options and their accounting consequences are detailed in Section 4 below for stakeholder selection.

#### Q7: How will the system handle edge cases and operational safeguards?
- **Missing Source Data**: If the source cost centre and account have ₹0.00 balance in the period, the run halts with `NO_SOURCE_EXPENSES_FOUND`. No empty vouchers or zero-rupee journals are generated.
- **Inactive / Deleted Cost Centres**: Validated at both preview and execution. If either the source or any target cost centre is inactive (`is_active = false`) or soft-deleted, the run fails with `COST_CENTRE_INACTIVE`.
- **Ineligible Accounts**: Enforced via `AccountGovernanceService.getCostCentrePolicy`. Any attempt to allocate into or out of Balance Sheet (`1xxx`, `2xxx`, `3xxx`) or Group accounts fails with `COST_CENTRE_PROHIBITED` or `ACCOUNT_GROUP_NON_POSTABLE`.
- **Rounding Residuals**: Solved deterministically using the **Largest Remainder Method (Hamilton-Hare quota)**. Zero paisa discrepancy, zero reliance on `5295` (Cash Rounding) or `5296` (Cash Over/Short), zero reliance on `1119` (Suspense). Perfect double-entry balance down to ₹0.01.
- **Closed Fiscal Periods**: Enforced via `accounting_fiscal_period.is_locked`. If the target period is locked, posting fails with `PERIOD_LOCKED`.
- **Cancelled / Reversed Sources**: Source lines that have been reversed or cancelled cannot be re-allocated.
- **Duplicate Runs**: Prevented by tracking source journal lines in `cost_allocation_run_line` and enforcing uniqueness on `(rule_id, fiscal_year, period_name)` for active runs.
- **Rule Changes**: Rules are strictly versioned (`version INT`, `effective_from`, `effective_to`). Once an allocation run is posted, it stores an immutable JSON snapshot of the exact rule targets and percentages used.

#### Q8: How will allocation output reconcile to the source amount and preserve the Trial Balance?
- **Double-Entry Symmetry**:
  - Source Cost Centre line: Credit source expense account by $S = \sum T_i$.
  - Destination Cost Centre lines: Debit destination expense accounts by $T_i$ where $\sum T_i = S$.
  - Total Debits = Total Credits.
  - Net GL expense impact = ₹0.00.
  - Company-wide Trial Balance is 100% preserved (Dr ₹3,380.00 = Cr ₹3,380.00).

#### Q9: How will allocation runs be audited and reversed without modifying posted history?
- Posted vouchers and journal lines are strictly immutable. `DELETE` is prohibited.
- Reversal creates a compensating `JOURNAL` voucher (subtype `ALLOCATION_REVERSAL`) swapping debits and credits.
- Vouchers are cross-linked via `reversed_by_voucher_id` and `reversal_of_voucher_id`.
- The run record transitions to `REVERSED` with `reversed_at`, `reversed_by`, and `reversal_voucher_id`.

#### Q10: Which permissions and approval roles already exist, and which are genuinely missing?
- **Existing in `staff-access-control.ts`**:
  - `COST_CENTRE.VIEW`, `COST_CENTRE.MANAGE`
  - `ACCOUNTING.VIEW`, `ACCOUNTING.CREATE`, `ACCOUNTING.SUBMIT`, `ACCOUNTING.APPROVE`, `ACCOUNTING.POST`, `ACCOUNTING.REVERSE`
- **Genuinely Missing for Cost Allocation**:
  - `COST_ALLOCATION.VIEW`: Read allocation rules, preview calculations, run history.
  - `COST_ALLOCATION.MANAGE_RULES`: Create, edit, activate/deactivate allocation rules.
  - `COST_ALLOCATION.RUN_PREVIEW`: Dry-run calculation without ledger mutation.
  - `COST_ALLOCATION.EXECUTE`: Maker action — execute allocation run and create draft/submitted voucher.
  - `COST_ALLOCATION.APPROVE`: Checker action — approve run and authorize GL posting (Maker-Checker SoD enforced: `runner_id !== approver_id`).
  - `COST_ALLOCATION.REVERSE`: Authorize compensating reversal of posted allocation run.

---

### 4. Allocation Bases Analysis & Decision Matrix (For User Approval)

The database contains both financial ledger lines and operational operational data (branches, orders, staff). Below is the objective analysis of candidate allocation methods:

| Allocation Method | Basis Definition | Source Data Dependency | Operational & Accounting Trade-offs | Feasibility |
|---|---|---|---|---|
| **Option A (Recommended for Phase C7.6 Step 4)** | **Predetermined Fixed Percentage / Weight Rule** | Configured targets with fixed weights (e.g. BLR Hub 40%, KOC Studio 35%, MAA Bakery 25%) summing to exactly 100.00%. | `cost_allocation_rule_target` table. Fully independent of transient sales fluctuations. | **Strengths**: Deterministic, predictable, fully auditable, immune to period revenue volatility or zero-sales launch periods. Conforms to standard Indian corporate accounting practice for monthly corporate overhead apportionment.<br>**Limitations**: Requires managerial review when branch scale changes significantly. | **100% Ready (Immediate implementation)** |
| **Option B** | **Actual Net Sales Revenue Ratio (Dynamic)** | Calculated dynamically as each branch's share of posted sales revenue (`4110`–`4140` less `4190`) for the allocation month. | `accounting_journal_line` WHERE account in `4xxx` and `branch_id = target_branch`. | **Strengths**: Ability-to-bear principle.<br>**Limitations**: Fails with division-by-zero if no sales were posted in the period (e.g., during testing or seasonal closure); heavily penalizes high-revenue branches for central IT overhead; requires all sales vouchers to be finalized before running overhead allocation. | **Viable as dynamic rule plugin** |
| **Option C** | **Operational Order Volume / Cake Output (Dynamic)** | Share of completed orders in `public.order` delivered by each branch in the month. | `public.order.branch_id` WHERE status = 'DELIVERED'. | **Strengths**: Volume-based activity metric.<br>**Limitations**: Non-ledger source; order status changes can lead to audit discrepancies; does not reflect differences in order value or complexity. | **Viable as secondary operational rule** |
| **Option D** | **Active Headcount Ratio (Dynamic)** | Share of active staff assigned to each branch in `public.branch_staff`. | `public.branch_staff.branch_id`. | **Strengths**: Well suited for HR/payroll overhead.<br>**Limitations**: Part-time vs full-time staff discrepancies; headcount not preserved historically in general ledger. | **Viable as secondary operational rule** |
| **Option E** | **Arithmetic Equal Split (1/N)** | Divides pool equally across $N$ active destination branches. | Count of active target cost centres. | **Strengths**: Simple arithmetic.<br>**Limitations**: Economically distortive (treating a flagship production bakery identically to an express kiosk). | **Discouraged except for generic overhead** |

**Design Recommendation**:
Build the engine around a clean **Strategy Pattern** where **Option A (`FIXED_PERCENTAGE`)** is the primary locked production rule type for Step 4, while the rule schema includes a `rule_type` enum (`FIXED_PERCENTAGE`, `REVENUE_RATIO`, `EQUAL_SPLIT`) allowing seamless future activation of dynamic bases without breaking schema or existing rules.

---

### 5. Proposed Database Schema Design (Zero Migration Conflict)

To support complete traceability, versioning, previewing, maker-checker authorization, and compensating reversals, the following 4 normalized tables are proposed for `public`:

```
┌──────────────────────────────┐
│  cost_allocation_rule        │
│  - id (PK)                   │
│  - rule_code (UNIQUE)        │
│  - name                      │
│  - rule_type (FIXED_PCT/etc) │
│  - source_cost_centre_id(FK) │
│  - source_account_id (FK)    │
│  - version (INT)             │
│  - is_active (BOOL)          │
│  - effective_from (DATE)     │
│  - effective_to (DATE, null) │
└──────────────┬───────────────┘
               │ 1:N
┌──────────────▼───────────────┐
│ cost_allocation_rule_target  │
│  - id (PK)                   │
│  - rule_id (FK)              │
│  - target_cost_centre_id (FK)│
│  - target_account_id (FK,opt)│
│  - percentage / weight (NUM) │
└──────────────────────────────┘

┌──────────────────────────────┐
│  cost_allocation_run         │
│  - id (PK)                   │
│  - run_number (UNIQUE)       │
│  - rule_id (FK)              │
│  - rule_version (INT)        │
│  - fiscal_year (VARCHAR)     │
│  - period_name (VARCHAR)     │
│  - total_source_amount (NUM) │
│  - total_allocated_amt (NUM) │
│  - status (DRAFT/POSTED/REV) │
│  - accounting_voucher_id (FK)│
│  - executed_by (FK user)     │
│  - approved_by (FK user)     │
│  - reversed_by_run_id (FK)   │
└──────────────┬───────────────┘
               │ 1:N
┌──────────────▼───────────────┐
│ cost_allocation_run_line     │
│  - id (PK)                   │
│  - run_id (FK)               │
│  - source_journal_line_id(FK)│
│  - target_cost_centre_id (FK)│
│  - allocated_amount (NUM)    │
│  - calculated_percentage(NUM)│
└──────────────────────────────┘
```

#### Exact Table Definitions:

1. **`public.cost_allocation_rule`**:
   - `id`: `text` PRIMARY KEY (ULID or uuid).
   - `rule_code`: `varchar(50)` UNIQUE NOT NULL (e.g. `RUL-IT-HO-01`).
   - `name`: `varchar(255)` NOT NULL.
   - `description`: `text` NULL.
   - `rule_type`: `varchar(30)` NOT NULL CHECK (`rule_type IN ('FIXED_PERCENTAGE', 'REVENUE_RATIO', 'EQUAL_SPLIT')`).
   - `source_cost_centre_id`: `text` NOT NULL REFERENCES `public.cost_centre(id)`.
   - `source_account_id`: `text` NOT NULL REFERENCES `public.accounting_account(id)`.
   - `version`: `integer` NOT NULL DEFAULT 1.
   - `is_active`: `boolean` NOT NULL DEFAULT true.
   - `effective_from`: `date` NOT NULL.
   - `effective_to`: `date` NULL.
   - `created_by`: `text` NOT NULL REFERENCES `public.user(id)`.
   - `created_at`, `updated_at`: `timestamptz` NOT NULL.
   - `deleted_at`: `timestamptz` NULL.

2. **`public.cost_allocation_rule_target`**:
   - `id`: `text` PRIMARY KEY.
   - `rule_id`: `text` NOT NULL REFERENCES `public.cost_allocation_rule(id)` ON DELETE CASCADE.
   - `target_cost_centre_id`: `text` NOT NULL REFERENCES `public.cost_centre(id)`.
   - `target_account_id`: `text` NULL REFERENCES `public.accounting_account(id)` (if NULL, defaults to `source_account_id`).
   - `percentage`: `numeric(7, 4)` NOT NULL CHECK (`percentage > 0 AND percentage <= 100`).
   - `sort_order`: `integer` NOT NULL DEFAULT 0.
   - `created_at`: `timestamptz` NOT NULL.

3. **`public.cost_allocation_run`**:
   - `id`: `text` PRIMARY KEY.
   - `run_number`: `varchar(50)` UNIQUE NOT NULL (e.g. `RUN-ALC-FY2026-27-202610-001`).
   - `rule_id`: `text` NOT NULL REFERENCES `public.cost_allocation_rule(id)`.
   - `rule_version`: `integer` NOT NULL.
   - `fiscal_year`: `varchar(20)` NOT NULL.
   - `period_name`: `varchar(50)` NOT NULL.
   - `allocation_date`: `date` NOT NULL.
   - `source_cost_centre_id`: `text` NOT NULL REFERENCES `public.cost_centre(id)`.
   - `source_account_id`: `text` NOT NULL REFERENCES `public.accounting_account(id)`.
   - `total_source_amount`: `numeric(15, 2)` NOT NULL.
   - `total_allocated_amount`: `numeric(15, 2)` NOT NULL.
   - `rounding_difference`: `numeric(15, 2)` NOT NULL DEFAULT 0.00.
   - `status`: `varchar(30)` NOT NULL CHECK (`status IN ('PREVIEW', 'SUBMITTED', 'POSTED', 'REVERSED')`).
   - `accounting_voucher_id`: `text` NULL REFERENCES `public.accounting_voucher(id)`.
   - `reversal_voucher_id`: `text` NULL REFERENCES `public.accounting_voucher(id)`.
   - `rule_snapshot`: `jsonb` NOT NULL (Freezes exact targets, percentages, and formulas).
   - `narration`: `text` NOT NULL.
   - `executed_by`: `text` NOT NULL REFERENCES `public.user(id)`.
   - `executed_at`: `timestamptz` NOT NULL.
   - `approved_by`: `text` NULL REFERENCES `public.user(id)`.
   - `approved_at`: `timestamptz` NULL.
   - `reversed_by`: `text` NULL REFERENCES `public.user(id)`.
   - `reversed_at`: `timestamptz` NULL.
   - `reversal_reason`: `text` NULL.

4. **`public.cost_allocation_run_line`**:
   - `id`: `text` PRIMARY KEY.
   - `run_id`: `text` NOT NULL REFERENCES `public.cost_allocation_run(id)` ON DELETE CASCADE.
   - `source_journal_line_id`: `text` NULL REFERENCES `public.accounting_journal_line(id)`.
   - `target_cost_centre_id`: `text` NOT NULL REFERENCES `public.cost_centre(id)`.
   - `target_account_id`: `text` NOT NULL REFERENCES `public.accounting_account(id)`.
   - `target_percentage`: `numeric(7, 4)` NOT NULL.
   - `allocated_amount`: `numeric(15, 2)` NOT NULL.
   - `created_at`: `timestamptz` NOT NULL.

---

### 6. Canonical Rounding Algorithm (Largest Remainder Method)

To guarantee that $\sum \text{allocated\_amount} \equiv \text{total\_source\_amount}$ down to the exact paisa, without ever using suspense accounts (`1119`) or cash variance accounts (`5295`, `5296`):

1. **Calculate Base Allocations**:
   For each target $i \in \{1 \dots N\}$:
   $$\text{exact}_i = \text{total\_source\_amount} \times \frac{\text{percentage}_i}{100.0}$$
   $$\text{cents}_i = \lfloor \text{exact}_i \times 100 \rfloor$$
   $$\text{fraction}_i = (\text{exact}_i \times 100) - \text{cents}_i$$
   $$\text{base\_amount}_i = \frac{\text{cents}_i}{100.0}$$

2. **Compute Cent Deficit**:
   $$\text{sum\_base} = \sum_{i=1}^N \text{cents}_i$$
   $$\text{target\_cents} = \text{round}(\text{total\_source\_amount} \times 100)$$
   $$\text{deficit} = \text{target\_cents} - \text{sum\_base}$$

3. **Distribute 1-Cent Remainders**:
   Sort targets in descending order by $\text{fraction}_i$ (tie-breaking deterministically by `target_cost_centre_id`).
   Add ₹0.01 (1 cent) to the top $\text{deficit}$ targets.

4. **Invariance Guarantee**:
   $$\sum_{i=1}^N \text{final\_amount}_i = \text{total\_source\_amount}$$
   Rounding error = ₹0.0000. Double-entry debits equal credits identically.

---

### 7. Execution, Posting & Reversal Lifecycle

```
[Maker]                                              [Checker]
Preview Calculation                                  Review
      │                                                 │
      ▼                                                 ▼
Draft Run (Status: PREVIEW/DRAFT) ──────────────► Approve Allocation
                                                        │
                                                        ▼
                                                Execute GL Posting
                                                (Status: POSTED)
                                                - Creates Voucher (JOURNAL)
                                                - Creates Journal Entry
                                                - Debits Target CC lines
                                                - Credits Source CC line
                                                        │
                                                        ▼
                                                Compensating Reversal
                                                (Status: REVERSED)
                                                - Creates Reversal Voucher
                                                - Swaps Debits/Credits
                                                - Cross-links Voucher IDs
```

1. **Dry-Run Preview**:
   - `previewAllocation(ruleId, period, date)`: Reads unallocated balance on `(source_cost_centre_id, source_account_id)` for the period, validates active status of cost centres and accounts, applies Largest Remainder calculation, and returns line-by-line preview WITHOUT mutating the database.
2. **Execute Allocation (Maker Action)**:
   - Validates period lock (`is_locked === false`).
   - Validates maker permission (`COST_ALLOCATION.EXECUTE`).
   - Validates that source hasn't already been allocated in this period.
   - Inserts `cost_allocation_run` (status: `SUBMITTED`) and `cost_allocation_run_line`.
3. **Approve & Post to GL (Checker Action)**:
   - Validates checker permission (`COST_ALLOCATION.APPROVE`).
   - Enforces **Segregation of Duties (SoD)**: `approved_by !== executed_by`.
   - Within an atomic PostgreSQL transaction:
     - Generates `accounting_voucher` (type `JOURNAL`, metadata `{ "source": "COST_ALLOCATION", "run_id": run.id }`).
     - Builds journal lines:
       - Credit source line: `account_id = source_account_id`, `cost_centre_id = source_cost_centre_id`, `credit_amount = total_allocated_amount`, `debit_amount = 0`.
       - Debit target lines: `account_id = target_account_id`, `cost_centre_id = target_cost_centre_id`, `debit_amount = allocated_amount`, `credit_amount = 0`.
     - Passes lines through `AccountGovernanceService.validateJournalLines` to guarantee CoA compliance.
     - Calls `AccountingJournalRepository.createJournalEntry`.
     - Updates run status to `POSTED` with `accounting_voucher_id = voucher.id`.
4. **Compensating Reversal**:
   - Validates reversal permission (`COST_ALLOCATION.REVERSE`).
   - Validates period is still open.
   - Within transaction:
     - Generates reversing `JOURNAL` voucher (swapped lines).
     - Cross-links vouchers: `voucher.reversed_by_voucher_id = rev_voucher.id`.
     - Updates run status to `REVERSED` with `reversal_voucher_id = rev_voucher.id`.

---

### 8. Segregation of Duties (SoD) & RBAC Matrix

| Role / Actor | Permissions Held | Can Manage Rules? | Can Run Preview? | Can Execute (Maker)? | Can Approve/Post (Checker)? | Can Reverse? |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Accountant / Cost Analyst** | `COST_ALLOCATION.VIEW`, `COST_ALLOCATION.RUN_PREVIEW`, `COST_ALLOCATION.EXECUTE` | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Finance Manager** | `COST_ALLOCATION.VIEW`, `COST_ALLOCATION.MANAGE_RULES`, `COST_ALLOCATION.APPROVE` | ✅ | ✅ | ❌ (SoD blocked if runner) | ✅ | ❌ |
| **Financial Controller / Admin** | All `COST_ALLOCATION.*` | ✅ | ✅ | ✅ | ✅ (If not maker) | ✅ |

- **SoD Hard Guard**:
  ```ts
  if (run.executed_by === actor.userId && !actor.isSuperAdmin) {
    throw new CostAllocationError("SOD_VIOLATION", "The maker who executed the allocation run cannot approve it.");
  }
  ```

---

### 9. Test Matrix (Verification Plan for Implementation)

| Test ID | Test Category | Scenario / Assertion |
|---|---|---|
| **T1** | Master Rule | Create valid fixed percentage rule summing to 100.00%. |
| **T2** | Master Rule Validation | Reject rule where percentage sum $\neq$ 100.00% (`INVALID_RULE_PERCENTAGES`). |
| **T3** | Master Rule Validation | Reject rule where target cost centre is identical to source cost centre. |
| **T4** | Governance Validation | Reject rule configured with Balance Sheet source or target account (`COST_CENTRE_PROHIBITED`). |
| **T5** | Governance Validation | Reject rule configured with summary group account (`ACCOUNT_GROUP_NON_POSTABLE`). |
| **T6** | Preview Calculation | Dry-run preview calculates exact amounts and largest remainder rounding without DB mutations. |
| **T7** | Rounding Invariance | Odd split (e.g. ₹100.00 across 3 targets @ 33.333% each) allocates ₹33.34, ₹33.33, ₹33.33. Sum = ₹100.00. Rounding error = ₹0.00. |
| **T8** | Rounding Guard | Verify zero postings to `5295` (Cash Rounding), `5296` (Cash Over/Short), or `1119` (Suspense). |
| **T9** | Closed Period Guard | Allocation run attempted in locked fiscal period rejected with `PERIOD_LOCKED`. |
| **T10** | Inactive Cost Centre Guard | Rule with deactivated cost centre fails with `COST_CENTRE_INACTIVE`. |
| **T11** | Zero Balance Guard | Attempting run with ₹0.00 unallocated source balance returns `NO_SOURCE_EXPENSES_FOUND`. |
| **T12** | Duplicate Run Guard | Attempting to re-allocate an already-allocated period/pool fails with `ALLOCATION_ALREADY_EXECUTED`. |
| **T13** | SoD Enforcement | Approver matching runner rejected with `SOD_VIOLATION`. |
| **T14** | Atomic GL Posting | Approved run creates immutable voucher and journal lines with correct cost-centre dimensions. |
| **T15** | Trial Balance Invariant | Pre-run TB = Post-run TB = Post-reversal TB = ₹3,380.00 Dr / Cr (Diff = ₹0.00). |
| **T16** | Compensating Reversal | Reversal run creates compensating entry, marks voucher reversed, and restores balances without line deletion. |

---

### 10. Unresolved Business Decisions for Stakeholder Review

Before implementing Step 4, stakeholder alignment is requested on:

1. **Approved Primary Allocation Basis**:
   - **Recommendation**: Accept **Option A (`FIXED_PERCENTAGE`)** as the primary locked production rule engine for Phase C7.6 Step 4, while establishing the schema to support dynamic bases (`REVENUE_RATIO`) in future iterations.
   - *Alternative*: Require dynamic revenue ratios (`REVENUE_RATIO`) immediately based on posted monthly sales per branch.

2. **Accounting Treatment of Allocated Credits**:
   - **Option 1 (Direct Cost Offset — Standard & Recommended)**: Credit the exact same operational expense account (e.g. Credit `5280` Software with `CC-HO`, Debit `5280` Software with `CC-BLR-01`). This preserves the natural account classification and requires zero new GL accounts.
   - **Option 2 (Secondary Clearing Account)**: Credit a dedicated contra/clearing expense account (e.g. `5298 Cost Allocation Clearing`). This requires adding a new GL account, which violates the strict 100-account freeze unless explicitly authorized.
   - **Recommendation**: Lock **Option 1 (Direct Cost Offset)** to maintain the frozen 100-account CoA.

3. **Voucher Type Designation**:
   - Allocation vouchers should be recorded as `voucher_type = 'JOURNAL'` with metadata `{ "source": "COST_ALLOCATION", "run_id": "..." }`, leveraging the existing voucher type constraints.

---

### 11. Bounded Implementation Steps (Post-Approval Roadmap)
- **Step 4A**: Database Migration & Schema Creation (`cost_allocation_rule`, `cost_allocation_rule_target`, `cost_allocation_run`, `cost_allocation_run_line`).
- **Step 4B**: Domain Types & Repository Layer (`cost-allocation.repository.ts`).
- **Step 4C**: Cost Allocation Engine & Domain Service (`cost-allocation.service.ts`) with Largest Remainder Rounding and SoD.
- **Step 4D**: Verification Suite, Independent PG Audit & Predecessor Regressions Pass.
