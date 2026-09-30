# CAKETOHOME ERP — PHASE 4: ACCOUNTING FOUNDATIONS
## FORENSIC AUDIT & ARCHITECTURAL PROPOSAL REPORT (FORENSIC ONLY — NO IMPLEMENTATION)

- **Date**: 2026-09-23 17:45:00 IST
- **Project**: CakeToHome ERP (`E:\vig\cakes2home-main\cakes2home-main`)
- **Git Branch**: `task/dev`
- **Git HEAD**: `f7d9a47`
- **Status**: FORENSIC INSPECTION COMPLETE — IMPLEMENTATION NOT STARTED

---

## 1. Executive Summary

This forensic audit represents an independent, rigorous inspection of the existing database, application code, transaction pipelines, and boundary configurations to establish the authoritative architectural foundation for **Phase 4 — Accounting Foundations**.

In strict compliance with the project process rule:
- **No tables were created or altered.**
- **No application routes or UI components were modified.**
- **No journal entries or vouchers were created.**
- **No historical business records were modified or deleted.**
- **No code was committed or pushed to Git.**

### Key Forensic Conclusions:
1. **Live Database Status**: Live PostgreSQL contains 284 tables. Exactly **zero** accounting, chart of accounts, general ledger, voucher, or journal tables exist. Zero database triggers or functions relate to double-entry bookkeeping.
2. **Codebase Status**: Zero executable accounting logic exists. Pre-existing code references are limited to permission definitions in `staff-access-control.ts` (`ACCOUNTING.VIEW`, `ACCOUNTING.POST`, `ACCOUNTING.APPROVE`, `ACCOUNTING.EXPORT`), report export headers in `excel-export-service.ts`, and invoice sequence prefixes in compliance settings.
3. **Sales & Historical Orders**: The 173 historical orders in `public."order"` all have `status = 'pending'`, store items and totals in JSONB `metadata`, and have `NULL` tax splits (no CGST/SGST/IGST breakdown). **These records MUST NOT be retro-posted.**
4. **Accounting Start Date**: Currently **NOT CONFIGURED** across the entire database, environment, and code. An explicit cut-off date and opening balance mechanism must be established prior to operational posting.
5. **Phase 1–3 Integration Readiness**: Phase 1 (Purchase: `subtotal`, `taxable_value`, `cgst`, `sgst`, `igst`, `total`, `supplier_id`), Phase 2 (Expense: `subtotal`, `taxable_value`, `cgst`, `sgst`, `igst`, `total`, `category_id`), and Phase 3 (Fleet: optional `expense_id`) are cleanly structured and ready for future voucher posting once the foundation is approved.

---

## 2. Skills Used & Explicit Skills Evaluation

In compliance with Step 0, every relevant available skill was evaluated:
- **`postgresql-and-supabase`**: Applied for deep schema inspection, constraint analysis, foreign key delete rules, index verification, and transaction safety audit.
- **`security-audit` & `security-auditing-and-owasp`**: Applied to design server-side authorization, segregation of duties (preventing self-approval), IDOR defenses, and branch isolation boundaries.
- **`api-design-and-security`**: Applied for future REST endpoint architecture, idempotency keys, and request validation design.
- **`clean-architecture` & `clean-code-and-refactoring`**: Applied to enforce strict separation: Domain Entities -> Repositories -> Services -> API Controllers -> UI.
- **`typescript-development`**: Applied for interface definitions, discriminated unions, and compile-time type safety design.
- **`saas-multi-tenant-architecture`**: Applied to design enterprise consolidation and branch-scoped tenant isolation.
- **`smart-coder`**: Applied for architecture-first inspection, tracing existing data flows, and establishing non-destructive designs.
- **`technical-documentation`**: Applied to synthesize high-density, evidence-based forensic reporting.
- **`no-duplicator`**: Applied to prevent parallel ledger implementations, redundant customer/supplier identity tables, or duplicate tax engines.
- **`git-workflow-and-releases`**: Applied to ensure zero unauthorized commits, zero pushes, and clean workspace state.

> [!NOTE]
> **Explicit Skill Disclosure**: A specialized "accounting / bookkeeping" agent skill is **not installed** in the system environment. Professional double-entry accounting standards (GAAP/Ind AS, dual-entry debit=credit invariants, voucher workflows, and segregation of duties) were directly synthesized and applied through the combination of `clean-architecture`, `smart-coder`, and `postgresql-and-supabase`.

---

## 3. Existing Accounting DB Structures

Live inspection of `information_schema.tables` (284 base tables in `public` schema) searching for accounting terms (`account`, `chart`, `ledger`, `journal`, `voucher`, `posting`, `debit`, `credit`, `trial_balance`, `profit_loss`, `balance_sheet`, `cash_book`, `day_book`, `bank`, `opening_balance`, `fiscal`, `financial_year`, `accounting`, `receivable`, `payable`):

| Table Name | Row Count | Purpose & Forensic Finding | Accounting Relevance |
|---|---|---|---|
| `account_holder` | 0 | Medusa/payment account holder placeholder. No columns populated. | Inactive legacy. Not an accounting GL account. |
| `credit_line` | 0 | Medusa line credit placeholder. 0 rows. | Inactive legacy. Not double-entry credit. |
| `customer_account_holder` | 0 | Junction table between customer and account holder. 0 rows. | Inactive legacy. |
| `order_credit_line` | 0 | Junction table between order and credit line. 0 rows. | Inactive legacy. |
| `rewards_loyalty_ledger` | 0 | Customer rewards points ledger. 0 rows. | Non-monetary loyalty points; not a financial GL. |
| `analytics_expense` | 0 | Legacy pre-ERP table; integer amount, no branch_id, no tax splits. | Superseded in Phase 2 by canonical `expense`. Untouched. |

**Database Invariant Confirmed**: Zero financial chart of accounts, vouchers, journals, ledgers, debit/credit rows, or fiscal periods exist in the database.

---

## 4. Existing Accounting Application Logic

Grep analysis across `frontend/src` classified all accounting-related keyword occurrences:

| Term / Finding | Source Location | Classification | Detailed Rationale |
|---|---|---|---|
| `ACCOUNTING.VIEW` | `staff-access-control.ts:200` | **G. Requires Reuse** | Pre-declared permission for read-only access to ledger and CoA. |
| `ACCOUNTING.POST` | `staff-access-control.ts:201` | **G. Requires Reuse** | Pre-declared permission for manual journal/voucher creation. |
| `ACCOUNTING.APPROVE` | `staff-access-control.ts:202` | **G. Requires Reuse** | Pre-declared permission for voucher approval before posting. |
| `ACCOUNTING.EXPORT` | `staff-access-control.ts:203` | **G. Requires Reuse** | Pre-declared permission for financial report export. |
| `credit_terms_days` | `purchase.types.ts`, `purchase.repository.ts` | **G. Requires Reuse** | Phase 1 field for supplier credit terms (in days) to calculate due dates. |
| `buildSheetCreditNotes` | `excel-export-service.ts:370` | **B. Reporting-Only** | Excel generation for GSTR-1 Table 9B credit note export. |
| `debit_note_prefix: "DN-CTH"` | `api-engine.ts:1075`, `invoice-billing-tab.tsx:20` | **G. Requires Reuse** | Administrative prefix setting for debit notes. |
| `credit_note_prefix: "CN-CTH"` | `api-engine.ts:1074`, `invoice-billing-tab.tsx:19` | **G. Requires Reuse** | Administrative prefix setting for credit notes. |
| `financial_year` preset | `api-engine.ts:23456` | **B. Reporting-Only** | Indian FY date calculation (April 1 to March 31) for order filtering. |
| `getAdminLoyaltyLedgers` | `api-engine.ts:11769` | **C. Transaction Logic** | Customer loyalty reward points; unrelated to double-entry accounting. |
| Mock cashback transaction | `api-engine.ts:11783` | **E. Mock/Fake/Demo** | Hardcoded demo loyalty reward entry `{ type: "credit", reason: "Promo Cashback" }`. |
| "Accounting posting available in Phase 7/8" | `purchase-panel.tsx:484` | **F. Legacy UI Label** | Text placeholder in purchase drawer pending Phase 4 accounting. |

**Application Logic Confirmed**: There is **no existing calculation engine, posting service, or journal balance checker** in the codebase.

---

## 5. Existing Sales Accounting Inputs

Empirical audit of `public."order"` (173 rows):
- **Primary Key**: `id` (e.g. `ord_1787809674273_sno5`).
- **Status Breakdown**: All 173 rows have `status = 'pending'`.
- **Currency**: `currency_code = 'inr'`.
- **Line Items & Totals**:
  - `public.order_line_item`: 0 rows.
  - `public.order_summary`: 0 rows.
  - **Factual Storage**: Items, quantities, prices, and branch associations reside inside the `order.metadata` JSONB column (e.g., `metadata.total_amount: 500`, `metadata.branch_id: "br_kollam_central"`, `metadata.items: [...]`).
- **Taxes**: 128 orders have no tax recorded (`tax_amount: null`); 23 have `tax_amount: 0`; 22 have lump-sum amounts (`25`, `18`, `51`). CGST, SGST, IGST are **strictly NULL** across all 173 orders.
- **Customer Association**: 170 orders have `customer_id: null` with `email` and guest info; 3 orders link to `customer.id`.
- **Architectural Mandate**: These 173 historical orders **cannot be retro-posted**. They represent pre-accounting operations. Future sales postings will only apply to orders created after the official `accounting_start_date`.

---

## 6. Existing Purchase Accounting Inputs

Empirical audit of Phase 1 Purchase Module:
- **Tables**: `purchase` (0 rows), `purchase_item` (0 rows), `purchase_payment` (0 rows), `supplier` (0 rows).
- **Financial Fields in `purchase`**:
  - `subtotal` (NUMERIC): Tax-exclusive base amount.
  - `discount` (NUMERIC): Trade discount deducted.
  - `taxable_value` (NUMERIC): Base taxable amount.
  - `cgst`, `sgst`, `igst` (NUMERIC): Factual GST breakdown.
  - `total` (NUMERIC): Total invoice liability (`taxable_value + cgst + sgst + igst`).
  - `payment_method` (VARCHAR): Bank, Cash, UPI, Credit.
  - `credit_terms_days` (INTEGER): Payment credit window.
  - `due_date` (DATE): Payment deadline.
  - `status` (VARCHAR): `DRAFT` -> `SUBMITTED` -> `APPROVED` -> `POSTED`.
  - `supplier_id` (UUID): Foreign key to canonical `supplier.id`.
  - `branch_id` (TEXT): Foreign key to `branch.id`.
- **Financial Fields in `purchase_payment`**:
  - `purchase_id` (UUID): Reference to parent purchase invoice.
  - `amount` (NUMERIC): Payment amount disbursed.
  - `method` (VARCHAR): Payment channel used.
  - `payment_date` (DATE): Date of disbursement.
- **Accounting Readiness**: **100% Ready**. Once Phase 4 establishes Voucher and Journal structures, an Approved purchase can seamlessly generate a `PURCHASE` voucher.

---

## 7. Existing Expense Accounting Inputs

Empirical audit of Phase 2 Expense Module:
- **Tables**: `expense` (0 rows), `expense_category` (11 rows seeded defaults).
- **Financial Fields in `expense`**:
  - `subtotal`, `discount`, `taxable_value`, `cgst`, `sgst`, `igst`, `total` (NUMERIC): Full tax breakdown.
  - `category_id` (UUID): Foreign key to `expense_category.id`.
  - `supplier_id` (UUID, nullable): Optional foreign key to `supplier.id`.
  - `branch_id` (TEXT): Foreign key to `branch.id`.
  - `payment_method` (VARCHAR): Cash, Bank Transfer, UPI, Credit Card, Corporate Card.
  - `status` (VARCHAR): `DRAFT` -> `SUBMITTED` -> `APPROVED` -> `POSTED`.
- **Seeded Expense Categories**:
  - Rent & Occupancy, Utilities, Packaging Material, Kitchen Supplies, Delivery & Logistics, Marketing & Promotion, Maintenance & Repairs, Staff Welfare & Refreshments, Software & Subscriptions, Licenses & Professional Fees, Miscellaneous.
- **Accounting Readiness**: **100% Ready**. Maps directly to Expense Accounts (CoA Group 5000) with Input GST tracking.

---

## 8. Existing Payment Structures

Empirical audit of `payment_transaction` (53 rows) and `order.metadata`:
1. **`payment_transaction` Table**:
   - Total rows: 53.
   - Date range: `2026-08-01` to `2026-09-20`.
   - Providers: `cod` (49 rows), `upi` (2 rows), `card` (2 rows).
   - Settlement statuses: `settled` (9 rows), `pending` (42 rows), `unsettled` (1 row).
   - Amounts: Stored as INTEGER (e.g. 1500 for ₹1,500).
2. **Order Metadata Payment Methods**:
   - `Cash on Delivery (COD)`: 113 orders
   - `cod`: 42 orders
   - `card`: 6 orders
   - `Online Verified`: 6 orders
   - `upi`: 4 orders
   - `Online UPI (Razorpay)`: 1 order
   - `null`: 1 order
3. **Data Normalization Finding**: Payment methods in historical orders are **unnormalized free text**. Accounting rules must normalize these via strict parser mappings and route unmapped or missing values to an `Unclassified Suspense` account rather than inventing payment modes.

---

## 9. Existing GST Structures

Empirical audit of tax settings and transaction records:
- **Store Tax Setting**: `setting.key = 'tax_rate_percent'` has value `5` (5% GST for bakery/restaurant food items).
- **Store Name**: `"CakeToHome Bakery"`.
- **Store Currency**: `"INR"`.
- **Seller GSTIN**: Currently `null` in database settings; retrieved dynamically in report engine via Admin Panel configuration.
- **Customer GSTIN**: Does not exist in `customer` schema (B2C retail focus).
- **Supplier GSTIN**: Factual `gstin` column exists in `supplier` table (Phase 1).
- **Factual vs Unavailable**:
  - Factual: 5% standard rate, Phase 1 purchase CGST/SGST/IGST fields, Phase 2 expense CGST/SGST/IGST fields.
  - Unavailable: Historical order tax splits (CGST/SGST/IGST are all `null`), State codes for inter-state customer classification.
  - Invariant: GST accounting will NOT synthesize fictitious state splits for historical orders.

---

## 10. Accounting Start Date Status

- **Database Search**: Searched `information_schema.columns` and `public.setting` for `accounting`, `start_date`, `fiscal`. Only `rewards_referral_program.start_date` exists.
- **Environment & Code**: No `ACCOUNTING_START_DATE` constant exists in `.env` or application config.
- **Definitive Status**:
  $$\textbf{ACCOUNTING START DATE = NOT CONFIGURED}$$
- **Required Architectural Mechanism**:
  A new enterprise configuration setting `accounting_start_date` (e.g. `2026-10-01` or user-defined date) must be recorded in `public.setting`. Transactions created prior to this timestamp are strictly non-posted historical operational data.

---

## 11. Chart of Accounts (CoA) Architecture — Proposal Only

The Chart of Accounts must be **enterprise-wide** with hierarchical numerical codes and branch-dimensioned transactional postings.

```
1000 - ASSETS
  ├── 1100 Current Assets
  │     ├── 1110 Cash & Bank Balances
  │     │     ├── 1111 Cash in Hand (Petty Cash)
  │     │     ├── 1112 Bank Operating Account (Current A/c)
  │     │     └── 1113 Payment Gateway Clearing (Razorpay/UPI)
  │     ├── 1120 Accounts Receivable
  │     │     ├── 1121 Trade Debtors (Customer Ledger Control)
  │     │     └── 1122 Undeposited COD Collections
  │     ├── 1130 Inventories & Consumables
  │     │     ├── 1131 Raw Materials (Flour, Sugar, Butter)
  │     │     ├── 1132 Packaging Materials
  │     │     └── 1133 Finished Goods (Cakes & Pastries)
  │     └── 1140 Duties & Taxes (Input Tax Credit)
  │           ├── 1141 Input CGST
  │           ├── 1142 Input SGST
  │           └── 1143 Input IGST
  └── 1200 Fixed / Non-Current Assets
        ├── 1210 Bakery Equipment & Ovens
        ├── 1220 Delivery Fleet & Vehicles
        └── 1230 Leasehold Improvements

2000 - LIABILITIES
  ├── 2100 Current Liabilities
  │     ├── 2110 Accounts Payable
  │     │     └── 2111 Trade Creditors (Supplier Ledger Control)
  │     ├── 2120 Duties & Taxes (Output Tax Payable)
  │     │     ├── 2121 Output CGST Payable
  │     │     ├── 2122 Output SGST Payable
  │     │     └── 2123 Output IGST Payable
  │     ├── 2130 Employee & Staff Payables
  │     └── 2140 Customer Advances / Unearned Revenue
  └── 2200 Long-Term Borrowings

3000 - EQUITY & RESERVES
  ├── 3100 Capital / Owners Equity
  ├── 3200 Retained Earnings
  └── 3300 Opening Balance Offset / Suspense Account

4000 - REVENUE
  ├── 4100 Direct Operating Revenue
  │     ├── 4110 Cake & Confectionery Sales
  │     └── 4120 Delivery & Shipping Fee Revenue
  └── 4200 Other Operating Income (Cashback, Discounts Received)

5000 - EXPENSES & COST OF GOODS SOLD
  ├── 5100 Direct Costs / Cost of Goods Sold (COGS)
  │     ├── 5110 Raw Material Consumption
  │     └── 5120 Packaging Expense
  └── 5200 Operating Expenses (OPEX)
        ├── 5210 Store & Kitchen Rent
        ├── 5220 Electricity & Utilities
        ├── 5230 Vehicle Fuel Expense (Fleet)
        ├── 5240 Delivery Partner Fleet Fees
        ├── 5250 Kitchen Repairs & Maintenance
        ├── 5260 Marketing & Customer Acquisition
        ├── 5270 Staff Salaries & Welfare
        ├── 5280 Software, POS & Cloud Subscriptions
        └── 5290 Bank & Gateway Processing Charges
```

### Proposed Schema: `accounting_account`
- `id` (UUID, PK)
- `code` (VARCHAR(20), UNIQUE, NOT NULL): e.g. `1111`, `2111`.
- `name` (VARCHAR(100), NOT NULL): e.g. "Cash in Hand", "Trade Creditors".
- `type` (VARCHAR(20), NOT NULL): `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`.
- `subtype` (VARCHAR(30)): `CURRENT_ASSET`, `FIXED_ASSET`, `CURRENT_LIABILITY`, etc.
- `parent_id` (UUID, FK -> `accounting_account.id` ON DELETE RESTRICT, nullable).
- `is_group` (BOOLEAN, DEFAULT false): True for parent categories, false for posting accounts.
- `is_system` (BOOLEAN, DEFAULT true): Protected accounts required by automated posting rules.
- `is_active` (BOOLEAN, DEFAULT true).
- `created_at`, `updated_at`, `deleted_at`.

---

## 12. Voucher Architecture — Proposal Only

All accounting activities must be initiated by an approved **Voucher**.

### Voucher Types:
1. `SALES`: Customer invoice billing.
2. `PURCHASE`: Supplier bill recording.
3. `PAYMENT`: Cash/Bank payment (to suppliers, expenses, staff).
4. `RECEIPT`: Cash/Bank receipt (from customers, COD remittance).
5. `EXPENSE`: Approved operational overhead.
6. `JOURNAL`: Manual adjustments, provisions, depreciation.
7. `CONTRA`: Cash-to-bank or bank-to-cash internal transfers.
8. `CREDIT_NOTE`: Sales returns / customer credits.
9. `DEBIT_NOTE`: Purchase returns / supplier debits.
10. `OPENING_BALANCE`: Establishing opening assets/liabilities.

### Lifecycle Workflow:
$$\text{DRAFT} \longrightarrow \text{SUBMITTED} \longrightarrow \text{APPROVED} \longrightarrow \text{POSTED}$$

### Proposed Schema: `accounting_voucher`
- `id` (UUID, PK)
- `voucher_no` (VARCHAR(50), UNIQUE, NOT NULL): e.g. `VCH-KOL-SALES-2026-0001`.
- `voucher_type` (VARCHAR(30), NOT NULL): Enum above.
- `voucher_date` (DATE, NOT NULL).
- `branch_id` (TEXT, NOT NULL, FK -> `branch.id` ON DELETE RESTRICT).
- `status` (VARCHAR(20), DEFAULT 'DRAFT'): `DRAFT`, `SUBMITTED`, `APPROVED`, `POSTED`, `CANCELLED`.
- `reference_type` (VARCHAR(30)): `ORDER`, `PURCHASE`, `EXPENSE`, `FLEET_FUEL`, `MANUAL`.
- `reference_id` (TEXT): ID of source record.
- `narration` (TEXT): Mandatory description.
- `created_by` (TEXT, NOT NULL).
- `submitted_by` (TEXT).
- `approved_by` (TEXT): Super Admin / Authorized Manager (must differ from `created_by`).
- `posted_by` (TEXT).
- `posted_at` (TIMESTAMPTZ).
- `reversed_by_voucher_id` (UUID, FK -> `accounting_voucher.id`, nullable).
- `created_at`, `updated_at`, `deleted_at`.

---

## 13. Journal / Double-Entry Architecture — Proposal Only

When a voucher transitions to `POSTED`, it generates an immutable `accounting_journal_entry` with matching `accounting_journal_line` records.

### The Fundamental Double-Entry Invariant:
$$\sum \text{Debit Amount} \equiv \sum \text{Credit Amount}$$

### Proposed Schema: `accounting_journal_entry`
- `id` (UUID, PK)
- `entry_no` (VARCHAR(50), UNIQUE, NOT NULL): e.g. `JRN-2026-00001`.
- `voucher_id` (UUID, UNIQUE, NOT NULL, FK -> `accounting_voucher.id` ON DELETE RESTRICT).
- `entry_date` (DATE, NOT NULL).
- `branch_id` (TEXT, NOT NULL, FK -> `branch.id` ON DELETE RESTRICT).
- `fiscal_year` (VARCHAR(10), NOT NULL): e.g. `2026-2027`.
- `total_amount` (NUMERIC(15, 2), NOT NULL): Sum of debits (which equals credits).
- `narration` (TEXT).
- `is_reversed` (BOOLEAN, DEFAULT false).
- `created_at` (TIMESTAMPTZ DEFAULT NOW(), NOT NULL).

### Proposed Schema: `accounting_journal_line`
- `id` (UUID, PK)
- `journal_entry_id` (UUID, NOT NULL, FK -> `accounting_journal_entry.id` ON DELETE RESTRICT).
- `line_no` (INTEGER, NOT NULL): 1, 2, 3...
- `account_id` (UUID, NOT NULL, FK -> `accounting_account.id` ON DELETE RESTRICT).
- `debit_amount` (NUMERIC(15, 2), NOT NULL DEFAULT 0.00).
- `credit_amount` (NUMERIC(15, 2), NOT NULL DEFAULT 0.00).
- `branch_id` (TEXT, NOT NULL, FK -> `branch.id` ON DELETE RESTRICT).
- `customer_id` (TEXT, nullable, FK -> `customer.id` ON DELETE RESTRICT).
- `supplier_id` (UUID, nullable, FK -> `supplier.id` ON DELETE RESTRICT).
- `narration` (TEXT).
- **Constraints**:
  - `CHECK (debit_amount >= 0)`
  - `CHECK (credit_amount >= 0)`
  - `CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))` (Strict single-sided line).

---

## 14. Conceptual Posting-Rule Matrix

| Transaction Type | Triggering Event | Debit Account | Credit Account | Tax Treatment | Sub-ledger Link |
|---|---|---|---|---|---|
| **Sales (Online Pre-paid)** | Order Delivered | `1113 Gateway Clearing` | `4110 Cake Sales`<br>`2121 Output CGST`<br>`2122 Output SGST`<br>`4120 Delivery Fee` | 2.5% CGST + 2.5% SGST on taxable cake amount | `customer_id` |
| **Sales (COD Delivered)** | Order Delivered | `1122 Undeposited COD` | `4110 Cake Sales`<br>`2121 Output CGST`<br>`2122 Output SGST`<br>`4120 Delivery Fee` | 2.5% CGST + 2.5% SGST | `customer_id` |
| **COD Remittance** | Rider / Cashier Remits Cash | `1111 Cash in Hand` | `1122 Undeposited COD` | None | None |
| **Bank Deposit (Contra)** | Branch deposits cash in bank | `1112 Bank Operating A/c` | `1111 Cash in Hand` | None | None |
| **Purchase Invoice** | Purchase Approved/Posted | `1131 Raw Materials`<br>`1141 Input CGST`<br>`1142 Input SGST` | `2111 Trade Creditors` | Input Tax Credit (ITC) | `supplier_id` |
| **Supplier Payment** | Purchase Payment Disbursed | `2111 Trade Creditors` | `1112 Bank Operating A/c` (or Cash) | None | `supplier_id` |
| **Expense Entry** | Expense Approved/Posted | `52xx Expense Account`<br>`1141 Input CGST`<br>`1142 Input SGST` | `1111 Cash` / `1112 Bank` / `2111 Creditors` | ITC where applicable | `supplier_id` (if vendor) |
| **Fleet Fuel Fill-up** | Fuel Expense Posted | `5230 Vehicle Fuel Expense`<br>`1141 Input CGST` (if invoice) | `1111 Cash` / `1112 Bank` / `2111 Creditor` | ITC where invoice present | Optional vendor |
| **Customer Refund** | Approved Return/Cancellation | `4110 Cake Sales` (Rev)<br>`2121 Output CGST`<br>`2122 Output SGST` | `1113 Gateway Clearing` / `1121 Customer` | Tax Credit Reversal | `customer_id` |
| **Purchase Return** | Debit Note to Supplier | `2111 Trade Creditors` | `1131 Raw Materials`<br>`1141 Input CGST` (Reversal) | ITC Reversal | `supplier_id` |
| **Opening Balance** | Fiscal Start Initializer | Asset Accounts (Debit) | Liability Accounts (Credit)<br>`3300 Opening Balance Offset` | None | Customer/Supplier IDs |

---

## 15. Customer & Supplier Ledger Design

### Customer Ledger (Accounts Receivable):
- **Canonical Identity**: `customer.id` (UUID/Text). Phone numbers and names are secondary search attributes.
- **Outstanding Formula**:
  $$\text{Customer Balance} = \sum (\text{Debits to Account 1121}) - \sum (\text{Credits to Account 1121})$$
- Debits represent invoices/deliveries. Credits represent payments/receipts/refunds. Positive balance = Customer owes business.

### Supplier Ledger (Accounts Payable):
- **Canonical Identity**: `supplier.id` (UUID).
- **Outstanding Formula**:
  $$\text{Supplier Balance} = \sum (\text{Credits to Account 2111}) - \sum (\text{Debits to Account 2111})$$
- Credits represent purchase invoices. Debits represent cash/bank disbursements and debit notes. Positive balance = Business owes supplier.
- **Bill-wise Matching**: Payments will optionally reference `purchase_id` to establish bill-by-bill outstanding and ageing (0–30, 31–60, 61–90, 90+ days).

---

## 16. Cash / Bank / Digital Payment Design

1. **Normalization Mapping**:
   - `'cod'`, `'Cash on Delivery (COD)'` $\longrightarrow$ `1122 Undeposited COD` (transfers to `1111 Cash in Hand` upon cashier reconciliation).
   - `'upi'`, `'Online UPI (Razorpay)'` $\longrightarrow$ `1113 Payment Gateway Clearing` (Razorpay).
   - `'card'`, `'Credit Card'` $\longrightarrow$ `1113 Payment Gateway Clearing`.
   - Missing / null payment method $\longrightarrow$ `1119 Unclassified Payment Clearing` (flagged for manual review).
2. **Reconciliation Boundary**:
   Gateway fees (e.g. Razorpay 2% + GST) are booked when the settlement payout reaches `1112 Bank Operating Account`:
   - Dr `1112 Bank Operating A/c` (Net Payout)
   - Dr `5290 Bank & Gateway Processing Charges` (MDR Fee)
   - Dr `1141 Input CGST` / `1142 Input SGST` (GST on MDR)
   - Cr `1113 Payment Gateway Clearing` (Gross Settlement)

---

## 17. GST Accounting Boundary

- **Factual Rules**:
  - Intra-state (Kerala $\rightarrow$ Kerala or Karnataka $\rightarrow$ Karnataka): 2.5% CGST + 2.5% SGST.
  - Inter-state (Kerala $\rightarrow$ Tamil Nadu): 5.0% IGST.
  - Bakery products HSN standard: `1905` (5% GST).
- **Boundary Safeguards**:
  - GSTIN will be read exclusively from `public.setting` or `supplier.gstin`.
  - Missing GSTINs or unknown states will remain `B2C Unregistered / Unspecified State` without inventing synthetic registration numbers or fake state codes.
  - No retroactive tax recalculations on the 173 historical orders.

---

## 18. Branch Accounting Model

**Model Selection: Option A — Enterprise Ledger with Branch Dimensions.**
- **Rationale**: CakeToHome is a unified legal entity operating across 53 active kitchen branches. The Chart of Accounts is global/enterprise-wide, ensuring standardized reporting across the entire business.
- **Branch Dimension**: Every `accounting_voucher`, `accounting_journal_entry`, and `accounting_journal_line` carries a mandatory `branch_id`.
- **Security & Scope**:
  - **Branch Manager**: Sever-side query filters restrict views strictly to the manager's authenticated session `branch_id`.
  - **Super Admin**: Has unrestricted enterprise access to view consolidated books, branch-specific ledgers, or inter-branch comparisons.
  - **Consolidation**: Enterprise Balance Sheet and P&L can be generated by simply omitting the branch filter; branch P&L is generated by filtering lines on `branch_id`.

---

## 19. Fiscal Year Model

- **Standard**: Indian Financial Year (1 April to 31 March).
- **Fiscal Year Format**: `YYYY-YYYY` (e.g., `2026-2027`).
- **Period Locking**:
  - Closed fiscal periods carry a status flag `is_locked = true`.
  - Posting or back-dating entries into a locked period is rejected at the database and service layer.

---

## 20. Opening Balance Model

1. **Cut-off Date**: Must match the official `accounting_start_date` (e.g., `2026-10-01 00:00:00`).
2. **Opening Voucher Type**: Special voucher `OPENING_BALANCE`.
3. **Double-Entry Balancing**:
   - Initial physical cash count, bank statement balance, inventory valuation, and supplier outstandings are entered.
   - The balancing figure is posted to `3300 Opening Balance Offset / Capital Reserve`:
     $$\text{Opening Assets} = \text{Opening Liabilities} + \text{Opening Capital / Offset}$$
4. **Approval Control**: Opening balance voucher requires explicit Super Admin authorization.

---

## 21. Permissions & RBAC Model

Extension of `staff-access-control.ts` with 6 explicit permissions:

| Permission ID | Role Scope | Functional Capability |
|---|---|---|
| `ACCOUNTING.VIEW` | Branch Manager / Staff / Accountant | Read-only access to Chart of Accounts, Vouchers, Journals, and Ledgers within branch scope. |
| `ACCOUNTING.CREATE` | Branch Staff / Accountant | Create and draft vouchers within authorized branch. |
| `ACCOUNTING.EDIT` | Branch Accountant / Manager | Modify draft vouchers before submission. |
| `ACCOUNTING.APPROVE` | Super Admin / Finance Head | Authorize submitted vouchers. Enforces: `approved_by != created_by` (No self-approval). |
| `ACCOUNTING.POST` | Finance Controller / Super Admin | Commit approved vouchers to the general ledger, creating immutable journal entries. |
| `ACCOUNTING.EXPORT` | Manager (Branch) / Super Admin (Enterprise) | Export Day Book, Cash Book, Trial Balance, P&L, Balance Sheet. |

---

## 22. Immutability & Reversal Model

1. **POSTED Entry Immutability**:
   Once a voucher is marked `POSTED` and its `accounting_journal_entry` is generated, the records are **cryptographically and architecturally frozen**.
   - No `UPDATE` or `DELETE` operations permitted on posted vouchers or lines.
   - Any attempt to delete or alter a posted record triggers a database exception.
2. **Correction via Reversal**:
   Corrections must follow GAAP standard practice:
   - Issue a linked `REVERSAL` voucher with opposite debits/credits.
   - Cross-reference the original voucher ID in `reversed_by_voucher_id`.
   - Issue a new corrected voucher.
   - Complete audit trail preserved for external financial compliance.

---

## 23. Report Dependency Map

| Report Name | Source Tables | Key Filtering Fields | Accounting / Posting Dependencies | Missing Data Behavior |
|---|---|---|---|---|
| **Day Book** | `accounting_journal_line` JOIN `accounting_journal_entry` | `branch_id`, `entry_date` | Chronological register of all debit/credit postings for a given date. | Returns empty list if no postings. |
| **Cash Book** | `accounting_journal_line` WHERE `account_id = '1111'` | `branch_id`, `date_range` | Running balance of cash receipts, cash payments, opening cash, closing cash. | Opening balance from prior period closing. |
| **Bank / Digital Book** | `accounting_journal_line` WHERE `account_id IN ('1112', '1113')` | `branch_id`, `date_range` | Deposits, withdrawals, gateway payouts, gateway charges. | Opening balance from prior period closing. |
| **General Ledger** | `accounting_journal_line` JOIN `accounting_account` | `account_id`, `branch_id`, `date_range` | Account-wise transaction register with debit/credit running balances. | 0 balance for accounts with no postings. |
| **Customer Ledger** | `accounting_journal_line` WHERE `customer_id IS NOT NULL` | `customer_id`, `branch_id`, `date_range` | Bill-by-bill invoices, payments, credits, and current customer receivable balance. | 0 balance if customer has no transactions. |
| **Supplier Ledger** | `accounting_journal_line` WHERE `supplier_id IS NOT NULL` | `supplier_id`, `branch_id`, `date_range` | Purchase bills, disbursements, debit notes, and current supplier payable balance. | 0 balance if supplier has no transactions. |
| **Voucher Register** | `accounting_voucher` | `branch_id`, `voucher_type`, `status`, `date_range` | Summary of all draft, submitted, approved, posted, and cancelled vouchers. | Factual list. |
| **Trial Balance** | Aggregated `accounting_journal_line` grouped by `account_id` | `branch_id` (optional), `as_of_date` | Invariant: $\sum \text{Debit Balances} = \sum \text{Credit Balances}$. | Balanced at 0.00 if no entries. |
| **Profit & Loss (P&L)** | `accounting_journal_line` for Accounts `4000` (Revenue) and `5000` (Expense) | `branch_id` (optional), `fiscal_year` / `date_range` | Net Profit = Total Revenue (4000) - Total Operating Costs (5000). | Factual revenue and cost. |
| **Balance Sheet** | `accounting_journal_line` for Accounts `1000` (Assets), `2000` (Liab), `3000` (Equity) | `branch_id` (optional), `as_of_date` | Invariant: $\text{Assets} \equiv \text{Liabilities} + \text{Equity} + \text{Current P&L}$. | Factual snapshot. |

---

## 24. Migration Strategy

The future migration must adhere strictly to enterprise safety principles:
1. **Additive Only**: Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
2. **Zero Destructive Operations**: No `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE`.
3. **Data Preservation**: Retain existing `order`, `delivery`, `delivery_partner`, `supplier`, `purchase`, `expense`, and `fleet_fuel` data untouched.
4. **Idempotent Seeding**: Standard Chart of Accounts (CoA) and Voucher Types seeded via `ON CONFLICT (code) DO NOTHING`.
5. **No Retro-Posting**: Zero automated journal entries generated during migration.

---

## 25. Proposed Verification & Test Strategy for Phase 4

| Category | Test Case | Target Assertion |
|---|---|---|
| **Database** | Schema, Constraints & FKs | All 4 new tables (`accounting_account`, `accounting_voucher`, `accounting_journal_entry`, `accounting_journal_line`) verified with foreign keys, uniqueness, and check constraints. |
| **Double-Entry** | Debit = Credit Invariant | Service and database reject any journal entry where total debits $\neq$ total credits. |
| **Security** | Branch Isolation | Manager of Branch A cannot read or post vouchers for Branch B (returns 0 rows / 403). |
| **Security** | Segregation of Duties | User attempting to approve their own voucher is rejected with `CANNOT_APPROVE_OWN_VOUCHER`. |
| **Security** | IDOR Defense | Manipulating voucher ID across branch boundaries fails-closed. |
| **Immutability** | Posted Entry Protection | Attempt to update or delete a POSTED voucher or journal line throws exception. |
| **Historical Data**| Baseline Preservation | Historical counts (`order`: 173, `delivery`: 57, `delivery_partner`: 30, `branch`: 57) remain unchanged. |
| **Type Safety** | TypeScript Compilation | `npx tsc --noEmit` exits with code 0. |
| **Build** | Production Next.js Build | `npm run build` exits with code 0. |

---

## 26. Duplicate & Legacy Code Findings

1. `analytics_expense`: 0 rows in database, unused in application code. Phase 2 established canonical `expense`. Retained untouched to avoid breaking legacy schemas.
2. `account_holder`, `credit_line`, `order_credit_line`: 0 rows in database. Relics of an incomplete Medusa extension. Will be bypassed in favor of canonical `accounting_account`.
3. `rewards_loyalty_ledger`: 0 rows. Dedicated to customer loyalty points, distinct from double-entry accounting.
4. `api-engine.ts:11783`: Hardcoded mock loyalty reward entry. Does not touch financial books.

---

## 27. Fabricated Data Audit

- Zero synthetic ledger entries exist in the live database.
- Zero fake opening balances exist.
- Zero mock chart of account rows exist.
- Missing historical metrics (such as customer GSTIN or order tax splits) evaluate strictly to `null` / `unavailable`.

---

## 28. Risks & Mitigations

1. **Risk: Unnormalized Legacy Payment Methods**:
   - *Mitigation*: The posting engine will use a strict parser mapping. Any unmapped or missing payment method routes to `1119 Unclassified Payment Clearing` with a required reconciliation alert.
2. **Risk: Missing Tax Splits in Historical Orders**:
   - *Mitigation*: Historical orders prior to `accounting_start_date` will never be posted to the ledger. Future orders will require explicit tax splits generated at checkout.
3. **Risk: Cross-Branch Voucher Tampering**:
   - *Mitigation*: Branch isolation is enforced from the authenticated session token on the server side (`staff-access-control.ts`), ignoring client-supplied payload branch overrides.

---

## 29. Blockers & Pre-Implementation Decisions Required

Before Phase 4 schema implementation can begin, the following decisions must be formally approved:
1. **Approval of Proposed Chart of Accounts**: Confirmation of the 4-digit hierarchical chart.
2. **Official Accounting Start Date**: Setting the cut-off timestamp (e.g., `2026-10-01 00:00:00 IST`).
3. **Initial Opening Balance Values**: Decision on whether opening balances are provided via Super Admin UI or initial CSV upload.

---

## 30. Recommended Phase 4 Implementation Sequence

```
Step 1: DB Migration — Create accounting_account, accounting_voucher, 
                       accounting_journal_entry, accounting_journal_line
        └── Seed default Chart of Accounts and Voucher Types (Idempotent)

Step 2: Core Domain Types & Repositories
        ├── accounting-account.repository.ts
        ├── accounting-voucher.repository.ts
        └── accounting-journal.repository.ts

Step 3: Accounting Service & Posting Engine
        ├── Validation (Debit = Credit invariant, non-negative amounts)
        ├── Voucher Lifecycle (Draft -> Submitted -> Approved -> Posted)
        ├── Segregation of Duties (created_by != approved_by)
        └── Posting Rule Engine (Sales, Purchase, Expense, Payment, Receipt)

Step 4: API Endpoints (20+ routes with verifyApiPermission)
        ├── /api/v1/admin/accounting/accounts
        ├── /api/v1/admin/accounting/vouchers
        ├── /api/v1/admin/accounting/journals
        └── /api/v1/admin/accounting/reports/*

Step 5: Ledger & Financial Statement Reports
        ├── Day Book, Cash Book, Bank Book
        ├── General Ledger, Customer Ledger, Supplier Ledger
        └── Trial Balance, Profit & Loss, Balance Sheet

Step 6: UI Implementation
        ├── Accounting Panel in Dashboard (/dashboard/shop/accounting)
        ├── Chart of Accounts Explorer
        ├── Voucher Creation & Approval Interface
        └── Financial Statement Viewer

Step 7: Verification & Reconciliation
        ├── TSC exit 0
        ├── Build exit 0
        ├── DB invariant transactional verification
        └── Security regression suite (21/21 PASS)
```
