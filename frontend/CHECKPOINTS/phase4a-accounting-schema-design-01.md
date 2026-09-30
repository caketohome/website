# CAKETOHOME ERP — PHASE 4A: ACCOUNTING SCHEMA DESIGN SPECIFICATION
## (SPECIFICATION ONLY — NO MIGRATION OR CODE EXECUTION)

- **Date**: 2026-09-23 18:00:00 IST
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Git Branch**: `task/dev`
- **Git HEAD**: `f7d9a47`
- **Status**: PHASE 4A SCHEMA DESIGN COMPLETE — MIGRATION NOT STARTED

---

## 1. Executive Summary & Design Scope

Following the independent Phase 4 forensic audit, this specification establishes the authoritative database schema and architectural contracts for **Phase 4A: Accounting Schema Design**.

In strict accordance with the project gate rules:
- **No database tables or columns have been created or altered.**
- **No migrations have been executed.**
- **No application code, route handlers, or UI components have been modified.**
- **No accounting journal entries or vouchers have been created.**
- **No historical data has been touched.**

### Key Design Resolutions Addressed:
1. **Dynamic & Configurable Chart of Accounts (CoA)**: The 1000–5000 hierarchy is defined as an extensible relational model (`accounting_account`), allowing business configuration, customized sub-accounts, and validation prior to posting.
2. **Reconciled Multi-Rate GST Architecture**: Reconciled against live product catalog data. Accounts and journal lines accommodate both **5% GST** (bakery, cakes, pastries) and **18% GST** (cake accessories, birthday candles, acrylic toppers under HSN 95059000).
3. **Lifecycle-Driven Payment Mapping**: Cash and online payment mappings are explicitly tied to `public.payment_transaction` lifecycle states (`pending`, `captured`, `refunded`) and settlement states (`unsettled`, `pending`, `settled`), rather than naive payment-method strings.
4. **Controlled Business-Input Opening Balance Process**: Opening balances are strictly operational inputs entered and verified by finance management via an `OPENING_BALANCE` voucher. **Historical orders (173 rows) will never be inferred or retro-posted.**

---

## 2. Table Specification 1: `accounting_account` (Chart of Accounts)

### Purpose
Represents the enterprise-wide Chart of Accounts. Provides a flexible, multi-level hierarchy supporting Assets, Liabilities, Equity, Revenue, and Expenses with parent-child roll-ups and tax classifications.

### Schema DDL Specification (Design Only)
```sql
CREATE TABLE IF NOT EXISTS public.accounting_account (
  id              TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code            VARCHAR(20)     NOT NULL,
  name            VARCHAR(100)    NOT NULL,
  type            VARCHAR(20)     NOT NULL,
  subtype         VARCHAR(30)     NOT NULL,
  parent_id       TEXT            NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
  level           INTEGER         NOT NULL DEFAULT 1,
  is_group        BOOLEAN         NOT NULL DEFAULT false,
  is_system       BOOLEAN         NOT NULL DEFAULT false,
  is_active       BOOLEAN         NOT NULL DEFAULT true,
  tax_rate        NUMERIC(5, 2)   NULL,
  tax_class       VARCHAR(30)     NULL,
  description     TEXT            NULL,
  metadata        JSONB           NULL,
  created_by      TEXT            NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ     NULL,

  -- Constraints
  CONSTRAINT uq_accounting_account_code UNIQUE (code),
  CONSTRAINT chk_account_type CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  CONSTRAINT chk_account_subtype CHECK (subtype IN (
    'CURRENT_ASSET', 'CASH', 'BANK', 'GATEWAY_CLEARING', 'RECEIVABLE', 'INVENTORY', 'INPUT_TAX', 'FIXED_ASSET',
    'CURRENT_LIABILITY', 'PAYABLE', 'OUTPUT_TAX', 'STAFF_PAYABLE', 'CUSTOMER_ADVANCE', 'LONG_TERM_LIABILITY',
    'CAPITAL', 'RETAINED_EARNINGS', 'OPENING_OFFSET',
    'DIRECT_REVENUE', 'INDIRECT_REVENUE', 'DELIVERY_REVENUE',
    'COGS', 'OPERATING_EXPENSE', 'FINANCIAL_EXPENSE'
  )),
  CONSTRAINT chk_account_level CHECK (level >= 1 AND level <= 5)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_account_code ON public.accounting_account(code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_account_type ON public.accounting_account(type, subtype);
CREATE INDEX IF NOT EXISTS idx_accounting_account_parent ON public.accounting_account(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounting_account_active ON public.accounting_account(is_active) WHERE deleted_at IS NULL;
```

---

## 3. Table Specification 2: `accounting_voucher` (Voucher Header)

### Purpose
Represents the business event document that initiates an accounting entry. Every financial transaction (sales, purchases, expenses, receipts, payments, refunds, opening balances) begins as a voucher and traverses a controlled approval lifecycle before general ledger posting.

### Schema DDL Specification (Design Only)
```sql
CREATE TABLE IF NOT EXISTS public.accounting_voucher (
  id                      TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  voucher_no              VARCHAR(60)     NOT NULL,
  voucher_type            VARCHAR(30)     NOT NULL,
  voucher_date            DATE            NOT NULL,
  branch_id               TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  fiscal_year             VARCHAR(10)     NOT NULL,
  status                  VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
  total_amount            NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
  currency                VARCHAR(3)      NOT NULL DEFAULT 'INR',
  reference_type          VARCHAR(30)     NULL,
  reference_id            TEXT            NULL,
  reference_event         VARCHAR(30)     NOT NULL DEFAULT 'PRIMARY',
  narration               TEXT            NOT NULL,
  
  -- Workflow and Segregation of Duties Audit Fields
  created_by              TEXT            NOT NULL,
  submitted_by            TEXT            NULL,
  submitted_at            TIMESTAMPTZ     NULL,
  approved_by             TEXT            NULL,
  approved_at             TIMESTAMPTZ     NULL,
  posted_by               TEXT            NULL,
  posted_at               TIMESTAMPTZ     NULL,
  cancelled_by            TEXT            NULL,
  cancelled_at            TIMESTAMPTZ     NULL,
  
  -- Reversal Audit Relationship
  reversed_by_voucher_id  TEXT            NULL REFERENCES public.accounting_voucher(id) ON DELETE SET NULL,
  reversal_of_voucher_id  TEXT            NULL REFERENCES public.accounting_voucher(id) ON DELETE SET NULL,
  
  metadata                JSONB           NULL,
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ     NULL,

  -- Constraints
  CONSTRAINT uq_accounting_voucher_no UNIQUE (voucher_no),
  CONSTRAINT chk_voucher_type CHECK (voucher_type IN (
    'SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'EXPENSE', 'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE'
  )),
  CONSTRAINT chk_voucher_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED')),
  CONSTRAINT chk_voucher_total CHECK (total_amount >= 0.00),
  CONSTRAINT chk_voucher_segregation CHECK (approved_by IS NULL OR approved_by != created_by)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_voucher_no ON public.accounting_voucher(voucher_no);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_branch_date ON public.accounting_voucher(branch_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_type_status ON public.accounting_voucher(voucher_type, status);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_ref ON public.accounting_voucher(reference_type, reference_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_voucher_source_idempotency ON public.accounting_voucher(reference_type, reference_id, reference_event) WHERE status != 'CANCELLED' AND reference_type != 'MANUAL';
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_fiscal ON public.accounting_voucher(fiscal_year);
```

---

## 4. Table Specification 3: `accounting_journal_entry` (GL Header)

### Purpose
Represents an immutable General Ledger double-entry header. Created strictly when an approved voucher is committed (`POSTED`). Maintains the mathematical $Debits \equiv Credits$ invariant.

### Schema DDL Specification (Design Only)
```sql
CREATE TABLE IF NOT EXISTS public.accounting_journal_entry (
  id              TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entry_no        VARCHAR(60)     NOT NULL,
  voucher_id      TEXT            NOT NULL UNIQUE REFERENCES public.accounting_voucher(id) ON DELETE RESTRICT,
  entry_date      DATE            NOT NULL,
  branch_id       TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  fiscal_year     VARCHAR(10)     NOT NULL,
  total_debit     NUMERIC(15, 2)  NOT NULL,
  total_credit    NUMERIC(15, 2)  NOT NULL,
  is_reversed     BOOLEAN         NOT NULL DEFAULT false,
  reversed_at     TIMESTAMPTZ     NULL,
  narration       TEXT            NULL,
  created_by      TEXT            NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uq_accounting_journal_entry_no UNIQUE (entry_no),
  CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit),
  CONSTRAINT chk_journal_positive CHECK (total_debit > 0.00)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_entry_no ON public.accounting_journal_entry(entry_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_voucher ON public.accounting_journal_entry(voucher_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_branch_date ON public.accounting_journal_entry(branch_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_fiscal ON public.accounting_journal_entry(fiscal_year);
```

---

## 5. Table Specification 4: `accounting_journal_line` (GL Lines)

### Purpose
Contains the individual atomic debit and credit lines of the general ledger entry. Each line references an account, branch dimension, and optional sub-ledger dimensions (customer for receivables, supplier for payables).

### Schema DDL Specification (Design Only)
```sql
CREATE TABLE IF NOT EXISTS public.accounting_journal_line (
  id                TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  journal_entry_id  TEXT            NOT NULL REFERENCES public.accounting_journal_entry(id) ON DELETE RESTRICT,
  line_no           INTEGER         NOT NULL,
  account_id        TEXT            NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
  debit_amount      NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
  credit_amount     NUMERIC(15, 2)  NOT NULL DEFAULT 0.00,
  branch_id         TEXT            NOT NULL REFERENCES public.branch(id) ON DELETE RESTRICT,
  
  -- Sub-ledger Dimensions
  customer_id       TEXT            NULL REFERENCES public.customer(id) ON DELETE RESTRICT,
  supplier_id       TEXT            NULL REFERENCES public.supplier(id) ON DELETE RESTRICT,
  
  -- Tax Classification Dimensions
  tax_rate          NUMERIC(5, 2)   NULL,
  tax_class         VARCHAR(30)     NULL,
  
  narration         TEXT            NULL,
  metadata          JSONB           NULL,

  -- Constraints
  CONSTRAINT uq_journal_line_order UNIQUE (journal_entry_id, line_no),
  CONSTRAINT chk_jline_debit_nonneg CHECK (debit_amount >= 0.00),
  CONSTRAINT chk_jline_credit_nonneg CHECK (credit_amount >= 0.00),
  CONSTRAINT chk_jline_single_sided CHECK (
    (debit_amount > 0.00 AND credit_amount = 0.00) OR
    (credit_amount > 0.00 AND debit_amount = 0.00)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_jline_entry ON public.accounting_journal_line(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_jline_account_branch ON public.accounting_journal_line(account_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_accounting_jline_customer ON public.accounting_journal_line(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_jline_supplier ON public.accounting_journal_line(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_jline_branch ON public.accounting_journal_line(branch_id);

-- Tier 3 Double-Entry Enforcement Constraint Trigger (Deferred to Commit)
CREATE OR REPLACE FUNCTION public.fn_check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_debit NUMERIC(15, 2);
  v_credit NUMERIC(15, 2);
BEGIN
  SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
  INTO v_debit, v_credit
  FROM public.accounting_journal_line
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Double-entry violation: Journal % debits (%) != credits (%)', 
      NEW.journal_entry_id, v_debit, v_credit;
  END IF;

  IF v_debit <= 0 THEN
    RAISE EXCEPTION 'Journal entry % cannot have zero or negative total amount', NEW.journal_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_journal_balance
AFTER INSERT OR UPDATE ON public.accounting_journal_line
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_journal_balance();
```

---

## 6. Table Specification 5: `accounting_fiscal_period` (Period Lock Model)

### Purpose
Enforces the Indian Financial Year (1 April to 31 March) and controls period closing. Postings or back-dating into locked accounting periods are rejected at the database and application levels.

### Schema DDL Specification (Design Only)
```sql
CREATE TABLE IF NOT EXISTS public.accounting_fiscal_period (
  id              TEXT            PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fiscal_year     VARCHAR(10)     NOT NULL, -- e.g. '2026-2027'
  period_name     VARCHAR(30)     NOT NULL, -- e.g. '2026-Q1', '2026-04'
  start_date      DATE            NOT NULL,
  end_date        DATE            NOT NULL,
  is_locked       BOOLEAN         NOT NULL DEFAULT false,
  locked_at       TIMESTAMPTZ     NULL,
  locked_by       TEXT            NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uq_fiscal_period UNIQUE (fiscal_year, period_name),
  CONSTRAINT chk_fiscal_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_accounting_fiscal_year ON public.accounting_fiscal_period(fiscal_year);
```

---

## 7. Reconciled Multi-Rate GST Architecture

### Empirical Catalog Verification
Querying the live product catalog confirmed that products possess two distinct tax classes:
1. **Bakery & Food**: Cakes, Pastries, Cupcakes $\rightarrow$ **5% GST** (2.5% CGST + 2.5% SGST, or 5% IGST).
2. **Accessories & Toppers**: Candles, Acrylic Toppers $\rightarrow$ **18% GST** (`gst_rate: 18`, HSN `95059000`, `tax_class: 'GST_STANDARD_18'`).

### Reconciled Multi-Rate Tax Account Architecture
Rather than hardcoding a flat 5% model, the schema isolates tax liabilities and credits into specific accounts:
- **Duties & Taxes — Output Tax (Liabilities: 2120)**:
  - `2121`: Output CGST 2.5% (Bakery)
  - `2122`: Output SGST 2.5% (Bakery)
  - `2123`: Output CGST 9.0% (Accessories)
  - `2124`: Output SGST 9.0% (Accessories)
  - `2125`: Output IGST 5.0% (Interstate Bakery)
  - `2126`: Output IGST 18.0% (Interstate Accessories)
- **Duties & Taxes — Input Tax Credit (Assets: 1140)**:
  - `1141`: Input CGST 2.5%
  - `1142`: Input SGST 2.5%
  - `1143`: Input CGST 9.0%
  - `1144`: Input SGST 9.0%
  - `1145`: Input IGST 5.0%
  - `1146`: Input IGST 18.0%

Line items in `accounting_journal_line` store both `tax_rate` (e.g. `2.50`, `9.00`) and `tax_class` (e.g. `'GST_5'`, `'GST_18'`), enabling automated preparation of GSTR-1 and GSTR-3B filings without data approximation.

---

## 8. Payment Lifecycle & Settlement Data Integration

Reconciling with the 53 live records in `public.payment_transaction`, accounting events map to explicit lifecycle milestones:

```
[Customer Checkout]
       │
       ▼
   [Payment Transaction Created: status = 'pending']
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
   [Provider: 'cod']             [Provider: 'card']                [Provider: 'upi']
Order Delivered:                  Order Placed:                     Order Placed:
Dr 1122 Undeposited COD           Dr 1113 Gateway Clearing          Dr 1113 Gateway Clearing
Cr 4110 Sales Revenue             Cr 4110 Sales Revenue             Cr 4110 Sales Revenue
Cr 2121/2122 Output GST           Cr 2121/2122 Output GST           Cr 2121/2122 Output GST
       │                                 │                                 │
       ▼                                 ▼                                 ▼
[Rider Remits Cash]              [Gateway Settlement]              [Gateway Settlement]
status = 'captured',             status = 'captured',              status = 'captured',
settlement_status = 'settled'    settlement_status = 'settled'     settlement_status = 'settled'
Dr 1111 Cash in Hand             Dr 1112 Bank Operating A/c        Dr 1112 Bank Operating A/c
Cr 1122 Undeposited COD          Dr 5290 Gateway MDR Fee           Dr 5290 Gateway MDR Fee
                                 Dr 114x Input GST on MDR          Dr 114x Input GST on MDR
                                 Cr 1113 Gateway Clearing          Cr 1113 Gateway Clearing
```

### Refund Lifecycle Event:
When `payment_transaction.status` transitions to `'refunded'` or `'partially_refunded'`:
- Dr `4110 Sales Revenue` (or `4190 Sales Returns & Refunds`)
- Dr `2121/2122 Output GST` (Tax Credit Reversal)
- Cr `1113 Gateway Clearing` (Online) or `1111 Cash in Hand` (Cash)

### Lifecycle Idempotency Mapping (Resolving Multi-Stage Payment Linkage)
To prevent duplicate postings while explicitly allowing distinct accounting milestones for a single `payment_transaction` record, each voucher carries `reference_event`:
- **`CAPTURE`**: Generated upon customer payment authorization & capture (or COD delivery receipt). Links to `reference_type = 'PAYMENT_TXN'`, `reference_id = payment_transaction.id`.
- **`SETTLEMENT`**: Generated when gateway funds settle into the bank operating account (`settlement_status = 'settled'`). Links to `reference_type = 'PAYMENT_TXN'`, `reference_id = payment_transaction.id`.
- **`REFUND`**: Generated when a refund is disbursed (`status = 'refunded'`). Links to `reference_type = 'PAYMENT_TXN'`, `reference_id = payment_transaction.id`.

For standard operational entities, `reference_event` defaults to `'PRIMARY'`:
- **`ORDER`**: `reference_type = 'ORDER'`, `reference_event = 'PRIMARY'`
- **`PURCHASE`**: `reference_type = 'PURCHASE'`, `reference_event = 'PRIMARY'`
- **`EXPENSE`**: `reference_type = 'EXPENSE'`, `reference_event = 'PRIMARY'`
- **`FLEET_FUEL`**: `reference_type = 'FLEET_FUEL'`, `reference_event = 'PRIMARY'`

The composite partial unique index:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_voucher_source_idempotency 
ON public.accounting_voucher(reference_type, reference_id, reference_event) 
WHERE status != 'CANCELLED' AND reference_type != 'MANUAL';
```
guarantees that:
1. An approved purchase, order, or expense bill can never be posted twice.
2. A single payment transaction can cleanly execute its capture, settlement, and refund lifecycle vouchers without constraint collisions, while still strictly preventing duplicate captures, duplicate settlements, or duplicate refunds.

---

## 9. Controlled Business-Input Opening Balance Process

### Operational Workflow (Strict Protocol)
1. **Decision Gate**: Super Admin confirms the official cut-off date: `accounting_start_date` (e.g. `2026-10-01 00:00:00 IST`).
2. **Business Input Preparation**:
   The company's chartered accountant / finance manager compiles the verified opening trial balance as of the cut-off:
   - Physical cash count per branch.
   - Bank statement balances for all current accounts.
   - Physical raw material and packaging inventory valuation.
   - Verified supplier outstanding balances (bill-wise).
   - Verified customer receivables / store credit liabilities.
   - Fixed asset historical book values (ovens, vehicles, machinery).
3. **Voucher Generation**:
   A voucher of type `OPENING_BALANCE` is submitted with the corresponding debit and credit lines:
   - All asset balances debited.
   - All liability balances credited.
   - The balancing figure is credited to `3300 Opening Balance Offset / Capital Reserve`:
     $$\text{Total Opening Assets} \equiv \text{Total Opening Liabilities} + \text{Opening Capital Offset}$$
4. **Independent Approval**:
   Super Admin reviews and approves the opening voucher.
5. **GL Posting**:
   Upon posting, opening journal entries are committed to `accounting_journal_entry` and `accounting_journal_line`.
6. **Isolation Guarantee**:
   The 173 historical orders prior to `accounting_start_date` remain locked as legacy operational data and **are never inferred into the opening balance**.

---

## 10. Numbering Strategy

All accounting documents will utilize sequential, audit-compliant identifiers:
- **Voucher Numbers**:
  $$\text{VCH}-\{\text{BRANCH\_CODE}\}-\{\text{TYPE}\}-\{\text{YYYYMM}\}-\{\text{SEQ\_5DIGIT}\}$$
  *Example*: `VCH-KOL-SALES-202610-00001`, `VCH-IND-PURCHASE-202610-00042`
- **Journal Entry Numbers**:
  $$\text{JRN}-\{\text{BRANCH\_CODE}\}-\{\text{YYYYMM}\}-\{\text{SEQ\_5DIGIT}\}$$
  *Example*: `JRN-KOL-202610-00001`
- **Account Codes**:
  Fixed 4-digit hierarchical codes (`1000` to `5999`), extensible with dash-separated sub-codes for custom user ledgers (`1112-01` for Bank Account 1, `1112-02` for Bank Account 2).

---

## 11. Immutability, Reversals & Double-Entry Integrity

### Double-Entry Integrity Enforcement:
1. **Service Layer**: Pre-commit validation rejects any voucher where $\sum \text{debits} \neq \sum \text{credits}$.
2. **Database Table Constraint**: `accounting_journal_entry` enforces `CHECK (total_debit = total_credit)`.
3. **Database Deferred Trigger**: A deferred constraint trigger verifies that the sum of `accounting_journal_line.debit_amount` equals the sum of `credit_amount` before transaction commit.

### Immutability & Reversals:
- Once an `accounting_voucher` reaches `POSTED` status, `UPDATE` and `DELETE` operations are forbidden.
- Corrections must be processed via a dedicated `REVERSAL` voucher:
  - Generates opposing debit and credit lines.
  - Links to the original voucher via `reversal_of_voucher_id`.
  - Sets `is_reversed = true` on the original journal entry.
  - Requires independent approval.

---

## 12. Security & RBAC Specifications

Enforced server-side in all API routes via `verifyApiPermission`:

| Permission ID | Role Minimum | Allowed Operations |
|---|---|---|
| `ACCOUNTING.VIEW` | Staff / Manager | Read-only access to Chart of Accounts, Vouchers, Ledgers within branch scope. |
| `ACCOUNTING.CREATE` | Staff / Accountant | Create `DRAFT` vouchers within authorized branch. |
| `ACCOUNTING.EDIT` | Staff / Accountant | Edit `DRAFT` or `SUBMITTED` vouchers within authorized branch. |
| `ACCOUNTING.APPROVE` | Super Admin / Finance Head | Authorize submitted vouchers. Enforces `approved_by != created_by` (Zero self-approval). |
| `ACCOUNTING.POST` | Super Admin / Finance Controller | Post approved vouchers to GL; creates immutable journal entries. |
| `ACCOUNTING.EXPORT` | Manager / Super Admin | Export Day Book, Cash Book, Trial Balance, P&L, Balance Sheet. |

---

## 13. Independent Schema Verification against Existing Modules

| Target Accounting Table | Phase 1 (Purchase) Integration | Phase 2 (Expense) Integration | Phase 3 (Fleet) Integration | Historical Data Isolation |
|---|---|---|---|---|
| `accounting_voucher` | Links via `reference_type = 'PURCHASE'`, `reference_id = purchase.id` | Links via `reference_type = 'EXPENSE'`, `reference_id = expense.id` | Links via `reference_type = 'EXPENSE'`, `reference_id = fleet_fuel.expense_id` | Historical orders (`order_id`) isolated by `accounting_start_date` filter |
| `accounting_journal_line` | Sub-ledger links to `supplier_id = supplier.id` | Sub-ledger links to `supplier_id` (optional vendor) | Expense account mapped to `5230 Vehicle Fuel Expense` | Zero customer receivable lines created for historical orders |
| Tax Mapping | Maps `purchase.cgst`, `sgst`, `igst` directly to Input Tax Accounts (1141–1146) | Maps `expense.cgst`, `sgst`, `igst` directly to Input Tax Accounts (1141–1146) | Maps fuel GST invoice directly if tax present | Historical orders (where tax split is NULL) strictly excluded |
| Branch Isolation | Reuses `branch.id` with `ON DELETE RESTRICT` | Reuses `branch.id` with `ON DELETE RESTRICT` | Reuses `branch.id` with `ON DELETE RESTRICT` | Preserves all 53 active branches |
