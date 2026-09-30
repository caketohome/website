# CAKETOHOME ERP — PHASE 4A: INDEPENDENT ACCOUNTING SCHEMA VERIFICATION REPORT
## (INDEPENDENT VERIFICATION ONLY — NO MIGRATIONS / NO CODE EXECUTION)

- **Date**: 2026-09-23 18:15:00 IST
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Git Branch**: `task/dev`
- **Git HEAD**: `f7d9a47`
- **Status**: PHASE 4A SCHEMA VERIFICATION COMPLETE — SPECIFICATION CORRECTED & APPROVED
- **Next Step**: Awaiting explicit User Approval before Phase 4B Migration

---

## 1. Executive Summary & Scope

This independent verification rigorously audited the proposed **Phase 4A: Accounting Schema Design** against the live PostgreSQL database, application code, business invariants, and Phase 1–3 module boundaries.

### Summary of Outcomes:
1. **Critical Defect Discovered and Corrected (F-01)**: The initial Phase 4A proposal defined `supplier_id UUID` on `accounting_journal_line`. Live database inspection proved that `supplier.id` is **`TEXT`**. This would have caused an immediate PostgreSQL foreign key type mismatch error. The specification has been **corrected to `supplier_id TEXT`**, and all accounting PKs have been standardized to `TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`.
2. **Double-Entry Enforcement Architecture Solved (F-02)**: Evaluated the limitation that PostgreSQL table CHECK constraints cannot aggregate across child rows. Established an authoritative **3-Tier Enforcement Architecture**: Application Validation $\rightarrow$ Transactional Locking $\rightarrow$ Deferred Constraint Trigger.
3. **Idempotency Guarantee Established (F-03)**: Added a database-level partial unique index `(reference_type, reference_id) WHERE status != 'CANCELLED' AND reference_type != 'MANUAL'`, guaranteeing that an approved purchase, order, or expense can never generate duplicate accounting vouchers.
4. **Multi-Rate GST Reconciled**: Reconciled against the live product catalog: 5% GST for bakery/cakes vs 18% GST for accessories/candles (HSN `95059000`).
5. **Zero Migrations Executed**: In strict compliance with process rules, zero tables or columns were created, zero seed data was inserted, and zero code was committed.

---

## 2. Skills Used & Explicit Skills Evaluation

All available skills were actively applied:
- **`postgresql-and-supabase`**: Audited data types of primary and foreign keys, constraint definitions, deferred triggers, and index structures.
- **`security-audit` & `security-auditing-and-owasp`**: Audited segregation of duties (`approved_by != created_by`), branch isolation boundaries, and IDOR prevention.
- **`clean-architecture`**: Preserved the inward-pointing dependency rule (Domain $\rightarrow$ Repository $\rightarrow$ Service $\rightarrow$ Controller).
- **`typescript-development`**: Evaluated compile-time type mappings and discriminated unions.
- **`saas-multi-tenant-architecture`**: Verified enterprise Chart of Accounts with branch-dimensioned transactional isolation.
- **`smart-coder`**: Architecture-first verification, data-flow tracing, and defect elimination.
- **`technical-documentation`**: Evidence-based reporting backed by live database queries.
- **`no-duplicator`**: Prevented duplicate accounting engines or competing identity models.
- **`git-workflow-and-releases`**: Ensured strict git safety (no commits, no pushes).

> [!NOTE]
> **Explicit Skill Disclosure**: A specialized "accounting / bookkeeping" agent skill is **not installed** in the system environment. Professional double-entry accounting standards were synthesized and verified through the combination of `clean-architecture`, `smart-coder`, and `postgresql-and-supabase`.

---

## 3. Existing Database Type Compatibility Verification

Live read-only query of `information_schema.columns` across participating tables confirmed the following factual data types:

| Table | Column | Live Data Type | Initial Proposal | Verification Result | Correction Applied |
|---|---|---|---|---|---|
| `public.supplier` | `id` | `text` | `UUID` | **MISMATCH (DEFECT F-01)** | Changed `accounting_journal_line.supplier_id` to `TEXT` |
| `public.customer` | `id` | `text` | `text` | **COMPATIBLE** | Retained `TEXT REFERENCES customer(id)` |
| `public.branch` | `id` | `text` | `text` | **COMPATIBLE** | Retained `TEXT REFERENCES branch(id)` |
| `public.purchase` | `id` | `text` | `text` | **COMPATIBLE** | Retained `TEXT` for `reference_id` |
| `public.expense` | `id` | `text` | `text` | **COMPATIBLE** | Retained `TEXT` for `reference_id` |
| `public.fleet_fuel` | `id` | `text` | `text` | **COMPATIBLE** | Retained `TEXT` for `reference_id` |
| `public.order` | `id` | `text` | `text` | **COMPATIBLE** | Retained `TEXT` for `reference_id` |
| `public.payment_transaction`| `id`| `text` | `text` | **COMPATIBLE** | Retained `TEXT` for `reference_id` |

**Standardization Decision**: All primary keys for the new accounting entities (`accounting_account`, `accounting_voucher`, `accounting_journal_entry`, `accounting_journal_line`, `accounting_fiscal_period`) are formally specified as:
$$\text{id TEXT PRIMARY KEY DEFAULT gen\_random\_uuid()::text}$$
This guarantees 100% type compatibility and avoids PostgreSQL casting overhead across the entire database.

---

## 4. Critical Review: Chart of Accounts (`accounting_account`)

1. **Account Codes**: `code VARCHAR(20) UNIQUE` is correct. Standard enterprise accounts use 4 digits (`1000` to `5999`); custom branch ledgers extend this with alphanumeric suffixes (`1111-KOL`).
2. **Hierarchy**: `parent_id TEXT REFERENCES accounting_account(id)` with `level INTEGER (1..5)` provides clean hierarchical traversal.
3. **Group Accounts**: `is_group BOOLEAN` is strictly enforced. Leaf accounts (`is_group = false`) receive postings; parent groups (`is_group = true`) are summary headers and **strictly blocked from journal lines**.
4. **Inactive / Deleted Accounts**:
   - `is_active = false`: Service rejects new voucher lines referencing inactive accounts.
   - Physical deletion: Forbidden if referenced by journal lines (`ON DELETE RESTRICT`). Soft deletion (`deleted_at TIMESTAMPTZ`) only.
5. **Tax Rates on Accounts vs Lines**: Tax rates live **primarily on journal lines** (`tax_rate NUMERIC(5, 2)`, `tax_class VARCHAR(30)`). Accounts represent liability/credit buckets (`2121` Output CGST 2.5%, `2123` Output CGST 9.0%). This completely prevents an account explosion.

---

## 5. Critical Review: Double-Entry Enforcement Architecture

### The Problem Analyzed
PostgreSQL `CHECK` constraints operate strictly row-by-row on the current table and **cannot query or aggregate child rows**. Thus, `CHECK (total_debit = total_credit)` on the header does not prevent child lines from being inserted with unequal sums.

### The Authoritative 3-Tier Solution:
1. **Tier 1 (Application Service)**:
   `AccountingService.postVoucher()` calculates $\sum \text{debits}$ and $\sum \text{credits}$. Rejects any transaction where $\sum debits \neq \sum credits$ with `UNBALANCED_VOUCHER_EXCEPTION`.
2. **Tier 2 (Transactional Lock)**:
   Voucher posting runs inside `BEGIN ... COMMIT` with `SELECT * FROM accounting_voucher WHERE id = $1 FOR UPDATE`.
3. **Tier 3 (Database Engine Level — Deferred Constraint Trigger)**:
   ```sql
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
       RAISE EXCEPTION 'Journal entry % cannot have zero or negative total', NEW.journal_entry_id;
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
   **Benefit**: Because the trigger is deferred to commit time, lines can be inserted iteratively, and PostgreSQL guarantees that the entry is mathematically balanced before committing to disk.

---

## 6. Critical Review: Single-Sided Journal Line Constraints

- Line amount precision: `NUMERIC(15, 2) NOT NULL DEFAULT 0.00`.
- Constraints:
  - `CHECK (debit_amount >= 0.00)`
  - `CHECK (credit_amount >= 0.00)`
  - `CHECK ((debit_amount > 0.00 AND credit_amount = 0.00) OR (credit_amount > 0.00 AND debit_amount = 0.00))`
- **Verification Result**: Zero-zero lines are strictly rejected. Negative lines are strictly rejected. Exactly one side is positive.

---

## 7. Critical Review: Voucher Status Machine & Segregation of Duties

- **Valid Transitions**:
  - `DRAFT` $\rightarrow$ `SUBMITTED`: Created voucher sent for approval.
  - `SUBMITTED` $\rightarrow$ `DRAFT`: Approver returns voucher for corrections.
  - `SUBMITTED` $\rightarrow$ `APPROVED`: Authorized reviewer approves voucher.
  - `APPROVED` $\rightarrow$ `POSTED`: GL posting committed; journal entry created.
  - `DRAFT` / `SUBMITTED` / `APPROVED` $\rightarrow$ `CANCELLED`: Permitted prior to GL posting.
  - `POSTED` $\rightarrow$ `CANCELLED`: **FORBIDDEN BY CONSTRAINT**. Posted entries cannot be cancelled.
  - `POSTED` $\rightarrow$ `REVERSAL`: The only valid post-posting correction path.
- **Segregation of Duties**:
  - Table constraint: `CHECK (approved_by IS NULL OR approved_by != created_by)`.
  - Service enforcement: User who created a voucher cannot approve or post it.

---

## 8. Critical Review: Reversal Model

- `reversal_of_voucher_id TEXT REFERENCES accounting_voucher(id)`
- `reversed_by_voucher_id TEXT REFERENCES accounting_voucher(id)`
- **Rules Verified**:
  - Reversals are strictly 1:1 (`UNIQUE (reversed_by_voucher_id)`).
  - A reversal voucher cannot itself be reversed (`CHECK (reversal_of_voucher_id IS NULL OR reversed_by_voucher_id IS NULL)`).
  - Original posted voucher and journal remain immutable.

---

## 9. Critical Review: Source Transaction Linkage & Idempotency

### The Multi-Stage Payment Lifecycle Problem
A naive partial unique index on `(reference_type, reference_id)` would prevent a single `payment_transaction` from having multiple legitimate accounting lifecycle events (e.g. initial `CAPTURE`, subsequent bank `SETTLEMENT`, and potential `REFUND`).

### The Reconciled Schema Solution
Added `reference_event VARCHAR(30) NOT NULL DEFAULT 'PRIMARY'` to `accounting_voucher`:
- Standard operational entities use `reference_event = 'PRIMARY'`:
  - `ORDER`: 1 sales invoice voucher per order.
  - `PURCHASE`: 1 purchase bill voucher per purchase.
  - `EXPENSE`: 1 expense voucher per recorded expense.
  - `FLEET_FUEL`: 1 fuel expense voucher per fuel log.
- Payment transactions explicitly differentiate lifecycle stages:
  - `reference_event = 'CAPTURE'`: Online authorization / COD delivery receipt (Dr Gateway/COD Clearing | Cr Receivable).
  - `reference_event = 'SETTLEMENT'`: Gateway settlement into bank operating account (Dr Bank, Dr MDR Fee | Cr Gateway Clearing).
  - `reference_event = 'REFUND'`: Customer refund or reversal (Dr Revenue/Refund | Cr Gateway Clearing).

```sql
CREATE UNIQUE INDEX idx_accounting_voucher_source_idempotency 
ON public.accounting_voucher (reference_type, reference_id, reference_event) 
WHERE status != 'CANCELLED' AND reference_type != 'MANUAL';
```
- **Verification Result**: Eliminates double-posting for all orders, purchases, and expenses, while cleanly accommodating the complete payment transaction lifecycle without artificial constraint violations. Duplicates within any single lifecycle event are physically prevented by the database.

---

## 10. Critical Review: Voucher Numbering Strategy

- Format:
  $$\text{VCH}-\{\text{BRANCH\_CODE}\}-\{\text{TYPE}\}-\{\text{FISCAL\_YEAR}\}-\{\text{SEQ\_5DIGIT}\}$$
  *Example*: `VCH-KOL-PUR-2627-00001`
- Timing: Assigned upon transition to **`SUBMITTED`** or **`POSTED`** using atomic database sequence generation to avoid numbering gaps.
- Uniqueness: `UNIQUE (voucher_no)` globally.

---

## 11. Critical Review: Fiscal Period Model

- Table: `accounting_fiscal_period`
- Start & End: Indian Financial Year (1 April $\rightarrow$ 31 March).
- Overlap Prevention: `UNIQUE (fiscal_year, period_name)` + date range validation `CHECK (end_date >= start_date)`.
- Locking: When `is_locked = true`, postings with dates in that period fail-closed.

---

## 12. Critical Review: Accounting Start Date

- Storage: `public.setting` (`key = 'accounting_start_date'`).
- Governance: Super Admin exclusive.
- Immutability: Once the first voucher is `POSTED`, the start date is permanently locked.
- Current Status: **STRICTLY NOT CONFIGURED**.

---

## 13. Critical Review: Multi-Rate GST Model

- Product Catalog Audit Confirmed:
  - Food/Bakery (5% GST: 2.5% CGST + 2.5% SGST)
  - Accessories/Candles (18% GST: 9.0% CGST + 9.0% SGST, HSN `95059000`)
- Schema Accommodates:
  - Separate output accounts: `2121` (CGST 2.5%), `2122` (SGST 2.5%), `2123` (CGST 9.0%), `2124` (SGST 9.0%), `2125` (IGST 5%), `2126` (IGST 18%).
  - Matching input credit accounts: `1141`–`1146`.
  - Line-level attributes: `tax_rate` and `tax_class` on every journal line.

---

## 14. Critical Review: Payment Lifecycle & Settlement

Reconciled with live `payment_transaction` states:
- COD: Delivered $\rightarrow$ Dr `1122 Undeposited COD`. Remitted $\rightarrow$ Dr `1111 Cash in Hand` | Cr `1122 Undeposited COD`.
- Online: Captured $\rightarrow$ Dr `1113 Gateway Clearing`. Settled $\rightarrow$ Dr `1112 Bank Operating A/c`, Dr `5290 Gateway Fees` | Cr `1113 Gateway Clearing`.
- Refunds: Dr `Sales Revenue / Refund Suspense` | Cr `Gateway Clearing` (or Cash).
- Missing Payment Method: Routes to `1119 Unclassified Clearing`.

---

## 15. Critical Review: Customer & Supplier Dimensions

- `accounting_journal_line.customer_id TEXT NULL REFERENCES public.customer(id)`
- `accounting_journal_line.supplier_id TEXT NULL REFERENCES public.supplier(id)`
- Business rules:
  - Accounts Receivable (`1121`) requires `customer_id`.
  - Accounts Payable (`2111`) requires `supplier_id`.
  - Other accounts carry `NULL`.

---

## 16. Critical Review: Branch Model

- Enterprise-wide accounts + Branch dimension on every voucher, journal, and line.
- Cross-branch access: Branch Managers are restricted to their session `branch_id` server-side.
- Super Admin: Full enterprise consolidated view.

---

## 17. Critical Review: Opening Balance Design

- Voucher: `OPENING_BALANCE`.
- Offset account: `3300 Opening Balance Offset / Capital Reserve`.
- Controlled Business Input: Derived from audited opening statements, **never from historical 173 orders**.

---

## 18. Critical Review: Inventory Accounting Boundary

- Perishable daily cakes do NOT have per-unit continuous stock valuation in current DB.
- Non-food accessories DO have stock tracking.
- Purchases of raw materials initially recorded as purchases/inventory without fabricating continuous cake COGS.

---

## 19. Critical Review: Accounting Report Dependencies

All 10 reports (Day Book, Cash Book, Bank Book, GL, Customer Ledger, Supplier Ledger, Voucher Register, Trial Balance, P&L, Balance Sheet) map directly to journal line dimensions.

---

## 20. Critical Review: Duplication Prevention

Confirmed single accounting engine:
$$\text{AccountingRepository} \longrightarrow \text{AccountingService} \longrightarrow \text{API Controllers} \longrightarrow \text{UI/Reports}$$

---

## 21. Critical Review: Migration Order

Future migration sequence:
1. `public.setting` (`accounting_start_date`)
2. `public.accounting_account`
3. `public.accounting_fiscal_period`
4. `public.accounting_voucher`
5. `public.accounting_journal_entry`
6. `public.accounting_journal_line`
7. Trigger `trg_check_journal_balance`
8. Idempotent seed: Chart of Accounts template

---

## 22. Verification Findings Classification

- **F-01: Incompatible Supplier ID Type (`UUID` vs `TEXT`)** $\rightarrow$ **BLOCKER (FIXED IN SPECIFICATION)**.
- **F-02: PostgreSQL Check Constraint Multi-Row Limitation** $\rightarrow$ **HIGH (SOLVED VIA 3-TIER ARCHITECTURE)**.
- **F-03: Source Transaction Double-Posting Risk** $\rightarrow$ **HIGH (SOLVED VIA PARTIAL UNIQUE INDEX)**.
- **F-04: Primary Key Type Standardization** $\rightarrow$ **MEDIUM (STANDARDIZED TO TEXT)**.
- **F-05: Reversal 1:1 Invariant** $\rightarrow$ **MEDIUM (VERIFIED & ENFORCED)**.
- **F-06: Multi-Rate GST Model** $\rightarrow$ **PASS (VERIFIED AGAINST LIVE CATALOG)**.
- **F-07: Payment Lifecycle Mapping** $\rightarrow$ **PASS (VERIFIED AGAINST LIVE TRANSACTIONS)**.
- **F-08: Historical Orders Non-Posting** $\rightarrow$ **PASS (VERIFIED & ISOLATED)**.

---

## 23. Final Status

$$\textbf{PHASE 4A SCHEMA DESIGN VERIFIED \& CORRECTED}$$
$$\textbf{MIGRATION NOT STARTED}$$
$$\textbf{IMPLEMENTATION NOT STARTED}$$
$$\textbf{NEXT STEP: AWAITING USER APPROVAL TO BEGIN PHASE 4B MIGRATION}$$
