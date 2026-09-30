# Phase 4F Step 4.5: Customer Receipts & AR Settlement — Forensic & Design Gate

- **Milestone Code**: `PHASE-4F-STEP-4.5-CUSTOMER-RECEIPTS-AR-DESIGN-01`
- **Scope**: Comprehensive Forensic Audit & Architectural Design for Customer Receipts, Accounts Receivable (AR) Settlement, Cash-on-Delivery (COD) Remittance, and Payment Gateway Clearing & MDR Settlement.
- **Status**: 📋 **FORENSIC & DESIGN GATE REVIEW ONLY — AWAITING EXPLICIT USER AUTHORIZATION**
- **Date**: 2026-09-26
- **Branch**: `task/dev`
- **Git Commit**: `f7d9a47` (Working tree clean, 0 commits, 0 pushes)
- **Preceding Milestone**: `CHECKPOINTS/phase4f-step4-4-sales-posting-cogs-01.md` (Complete & Frozen ✅)

---

## 1. Actual Schema Findings

An independent, read-only forensic inspection of the PostgreSQL database was performed against live tables and constraints:

### 1.1 `public.payment_transaction` Schema
- **Primary Key**: `id TEXT PRIMARY KEY` (indexed via `payment_transaction_pkey`).
- **Columns & Data Types**:
  - `id` (`text`, NOT NULL)
  - `company_id` (`text`, NULLABLE, default: `'default_company'`)
  - `branch_id` (`text`, NOT NULL)
  - `order_id` (`text`, NOT NULL)
  - `customer_id` (`text`, NOT NULL)
  - `amount` (`integer`, NOT NULL) — Stored as whole INR rupees in existing historical data.
  - `currency` (`text`, NOT NULL, e.g. `'INR'`)
  - `idempotency_key` (`text`, NULLABLE)
  - `status` (`text`, NOT NULL, default: `'pending'`)
  - `settlement_status` (`text`, NOT NULL, default: `'unsettled'`)
  - `provider` (`text`, NOT NULL, default: `'cod'`)
  - `provider_ref` (`text`, NULLABLE)
  - `created_at` (`timestamptz`, NOT NULL, default: `now()`)
  - `updated_at` (`timestamptz`, NOT NULL, default: `now()`)
  - `deleted_at` (`timestamptz`, NULLABLE)
- **Key Schema Discoveries**:
  - **No `payment_type` column**: Does NOT exist on `payment_transaction` (verified via `information_schema.columns`).
  - **Partial Indexes**:
    - `IDX_payment_transaction_deleted_at` ON `payment_transaction(deleted_at) WHERE (deleted_at IS NULL)`
    - `idx_payment_transaction_order_id` ON `payment_transaction(order_id) WHERE (deleted_at IS NULL)`
    - `idx_payment_transaction_idempotency` ON `payment_transaction(idempotency_key) WHERE ((deleted_at IS NULL) AND (idempotency_key IS NOT NULL))`
  - **Foreign Key Constraints**: `order_id`, `branch_id`, and `customer_id` on `payment_transaction` do NOT currently enforce foreign keys with `ON DELETE RESTRICT` (12 historical transactions are orphaned from legacy prototypes).

### 1.2 `public.order` Schema
- **Primary Key**: `id TEXT PRIMARY KEY`
- **Columns**: `id`, `region_id`, `display_id`, `customer_id`, `version`, `sales_channel_id`, `status` (USER-DEFINED enum), `is_draft_order`, `email`, `currency_code`, `shipping_address_id`, `billing_address_id`, `no_notification`, `metadata` (`jsonb`), `created_at`, `updated_at`, `deleted_at`, `canceled_at`, `custom_display_id`, `locale`.
- **Key Schema Discoveries**:
  - **No `payment_status` column**: Does NOT exist as a standalone relational column on `public.order`.
  - Payment information is stored within `order.metadata`:
    - `metadata->>'payment_status'` (e.g. `'captured'`, `'pending'`)
    - `metadata->>'payment_method'` (e.g. `'cod'`, `'upi'`, `'card'`, `'Cash on Delivery (COD)'`, `'Online Verified'`)
    - `metadata->>'financial_voucher_id'` (linked to posted sales voucher in Step 4.4)
    - `metadata->>'journal_entry_id'` (linked to compound sales journal entry in Step 4.4)

### 1.3 `public.accounting_voucher` & `public.accounting_journal_line` Schema
- **Voucher Type**: `chk_voucher_type` CHECK constraint strictly includes `'RECEIPT'`:
  `CHECK (voucher_type IN ('SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'EXPENSE', 'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE'))`.
- **Single Journal Entry Constraint**: `accounting_journal_entry.voucher_id` has a strict `UNIQUE` constraint (`accounting_journal_entry_voucher_id_key`). Every receipt voucher generates exactly ONE journal entry.
- **Journal Line Customer Linkage**:
  - `accounting_journal_line.customer_id` is `TEXT NULLABLE` with `FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE RESTRICT`.
  - In `public.customer`, exactly 57 customers exist. No customer with `id = 'guest'` exists in the table.
  - Setting `customer_id = 'guest'` on a journal line will violate foreign key constraints. Guest orders must record `customer_id = NULL` on the journal line, while preserving order and guest customer identity inside `narration` and `metadata`.

---

## 2. Actual Payment Lifecycle Findings

Analysis of all 53 live rows in `public.payment_transaction`:

| Status | Provider | Count | Min Amount | Max Amount | Notes |
|:---|:---|:---:|:---:|:---:|:---|
| `captured` | `card` | 2 | ₹534 | ₹534 | Prepaid card capture |
| `captured` | `upi` | 2 | ₹1,069 | ₹1,069 | Prepaid UPI capture |
| `captured` | `cod` | 2 | ₹798 | ₹798 | Delivered COD order cash collected |
| `partially_refunded` | `cod` | 3 | ₹1,500 | ₹2,500 | Post-settlement operational concession |
| `refunded` | `cod` | 1 | ₹2,000 | ₹2,000 | Full operational refund |
| `pending` | `cod` | 43 | ₹117 | ₹1,500 | Unsettled COD orders |

### Operational Semantics:
1. **Prepaid Capture**: When an order is placed online and verified via gateway callback, `payment_transaction` is recorded with `status = 'captured'` and `settlement_status = 'unsettled'`.
2. **Gateway Payout/Settlement**: When Stripe/Razorpay executes a payout batch to the merchant's bank account, transactions transition to `settlement_status = 'settled'`.
3. **COD Collection**: COD orders start with `status = 'pending'`, `settlement_status = 'unsettled'`. When delivery partner remits cash at the branch, status transitions to `status = 'captured'`, `settlement_status = 'settled'`.
4. **Historical Isolation**: All 53 existing transactions occurred between `2026-08-01` and `2026-09-20` and are strictly quarantined as pre-accounting prototype data.

---

## 3. Actual Existing Service / Repository Findings

1. **`SalesPostingService` (`frontend/src/lib/services/sales-posting.service.ts`)**:
   - Manages Sales Voucher Drafting (`createSalesVoucherDraft` - Step 4.2).
   - Manages Sales Voucher Submission (`submitSalesVoucher` - Step 4.2).
   - Manages Sales Voucher Approval (`approveSalesVoucher`, `rejectSalesVoucher` - Step 4.3).
   - Manages Atomic Sales Posting, Inventory Fulfillment & FIFO COGS (`postSalesVoucherAndFulfillInventory` - Step 4.4).
   - Contains **ZERO** customer receipt or AR settlement methods (Step 4.5 is strictly clean).
2. **`PostingService` (`frontend/src/lib/services/posting.service.ts`)**:
   - Canonical posting foundation: `createVoucherDraft`, `submitVoucher`, `approveVoucher`, `postVoucher`, `cancelVoucher`.
   - Validates accounting start date, fiscal periods, active non-group accounts, double-entry balance, and SoD.
3. **`OrderRepository` & `OrderService`**:
   - Directly query and mutate `payment_transaction` in raw SQL.
   - No dedicated `payment-transaction.repository.ts` exists.
4. **Residue Check**:
   - Grep search for `1113`, `5290`, `PAYMENT_RECEIPT`, `CUSTOMER_RECEIPT`, `AR_SETTLEMENT`, `GATEWAY_SETTLEMENT` confirmed **zero partial implementation residue** in `frontend/src`.

---

## 4. Account Verification

The 6 relevant Chart of Accounts records in `public.accounting_account` were verified independently:

| Code | Name | Type | Subtype | Is Group | Is System | Is Active | Parent Account |
|:---|:---|:---|:---|:---:|:---:|:---:|:---|
| **1111** | Cash in Hand | `ASSET` | `CASH` | `false` | `true` | `true` | 1110 (Cash and Bank Balances) |
| **1112** | Bank Operating A/c | `ASSET` | `BANK` | `false` | `true` | `true` | 1110 (Cash and Bank Balances) |
| **1113** | Gateway Clearing | `ASSET` | `GATEWAY_CLEARING` | `false` | `true` | `true` | 1110 (Cash and Bank Balances) |
| **1121** | Accounts Receivable | `ASSET` | `RECEIVABLE` | `false` | `true` | `true` | 1120 (Receivables and Advances) |
| **1122** | Undeposited COD | `ASSET` | `CURRENT_ASSET` | `false` | `true` | `true` | 1120 (Receivables and Advances) |
| **5290** | Payment Gateway MDR Fees | `EXPENSE` | `OPERATING_EXPENSE` | `false` | `true` | `true` | 5200 (Operational & Admin Expenses) |

**Conclusion**: All 6 accounts exist in the master Chart of Accounts, are leaf accounts (`is_group = false`), system-managed (`is_system = true`), and active (`is_active = true`).

---

## 5. AR Settlement Model

### 5.1 Sales-Created AR Identification
In Step 4.4, posting an approved sales voucher produces a compound journal entry with:
- **Prepaid Orders**: Debit Account `1121` (Accounts Receivable) for `invoiceTotal`.
- **COD Orders**: Debit Account `1122` (Undeposited COD) for `invoiceTotal`.
- The posted sales voucher has `voucher_type = 'SALES'`, `status = 'POSTED'`, and links to `order.id` via `reference_type = 'ORDER'`, `reference_id = order.id`.

### 5.2 AR Clearing Mathematical Identity
- **Prepaid Settlement**: A `RECEIPT` voucher posts a Credit to `1121 Accounts Receivable`, reducing the customer's open balance.
- **COD Settlement**: A `RECEIPT` voucher posts a Credit to `1122 Undeposited COD`, clearing the rider collection balance.
- **Outstanding Amount Calculation**:
  $$\text{Outstanding AR} = \text{Posted Invoices (Dr 1121/1122)} - \text{Posted Receipts (Cr 1121/1122)} - \text{Credit Notes (Cr 1121/1122)}$$
- **Overpayment Prevention**: Receipts exceeding `outstanding_amount` must fail closed with `OVERPAYMENT_NOT_PERMITTED`.
- **Partial Receipts**: Multiple receipts against a single order/invoice are supported, each reducing the remaining outstanding balance.

---

## 6. Receipt Event Model (Prepaid Orders)

For prepaid orders (Card, UPI, Netbanking):

### Event: Customer Receipt (Capture Confirmation)
- **Trigger**: Payment Gateway webhook or manual receipt recording confirming customer payment capture.
- **Voucher Type**: `RECEIPT`
- **Double-Entry Journal**:
  - **Debit**: `1113 Gateway Clearing` (₹ Amount Received)
  - **Credit**: `1121 Accounts Receivable` (₹ Amount Settled)
- **Mathematical Balance**: $\sum \text{Dr} \equiv \sum \text{Cr}$.
- **Net Result**: Clears customer AR from Account `1121` and moves funds into Account `1113` (Gateway Clearing), awaiting bank payout.

```
Debit:  1113 Gateway Clearing            ₹1,050.00
Credit: 1121 Accounts Receivable         ₹1,050.00
```

---

## 7. Gateway Settlement Model (MDR & Payout)

When the payment gateway (Stripe/Razorpay) transfers accumulated captured funds to the merchant bank account:

### Event: Gateway Payout Settlement
- **Trigger**: Payout batch notification from gateway detailing gross capture, MDR fees deducted, and net bank deposit.
- **Voucher Type**: `RECEIPT` (or `JOURNAL`)
- **Double-Entry Journal**:
  - **Debit**: `1112 Bank Operating A/c` (Net funds deposited in bank)
  - **Debit**: `5290 Payment Gateway MDR Fees` (Gateway commission / service charges)
  - **Credit**: `1113 Gateway Clearing` (Gross settled amount)
- **Mathematical Balance**:
  $$\text{Net Bank Deposit} + \text{MDR Fee} \equiv \text{Gross Gateway Clearing Credit}$$
- **Net Result**: Clears Account `1113 Gateway Clearing` to zero, recognizes processing fee expense in `5290`, and increases liquid cash in `1112 Bank Operating A/c`.

```
Debit:  1112 Bank Operating A/c          ₹1,029.00
Debit:  5290 Payment Gateway MDR Fees        ₹21.00  (e.g., 2% MDR)
Credit: 1113 Gateway Clearing            ₹1,050.00
```

---

## 8. COD Model (Cash Remittance at Branch)

For Cash-on-Delivery (COD) orders:

### Event: Rider Cash Remittance
- **Trigger**: Delivery rider returns from route and hands over collected physical currency to the branch cashier.
- **Voucher Type**: `RECEIPT`
- **Double-Entry Journal**:
  - **Debit**: `1111 Cash in Hand` (Physical currency received in branch register)
  - **Credit**: `1122 Undeposited COD` (Relieves delivery partner obligation)
- **Mathematical Balance**: $\text{Debit (1111)} \equiv \text{Credit (1122)}$.
- **Net Result**: Clears Account `1122 Undeposited COD` and increases branch cash in Account `1111`.

```
Debit:  1111 Cash in Hand                ₹1,050.00
Credit: 1122 Undeposited COD             ₹1,050.00
```

*(Note: Subsequent physical bank cash deposit from branch register `1111 Cash in Hand` $\rightarrow$ `1112 Bank Operating A/c` is a `CONTRA` voucher, which is an internal treasury operation separate from customer AR settlement).*

---

## 9. Date Semantics

To prevent date conflation and audit corruption, strict date semantics are established:

| Date Field | Authority & Source | Accounting Purpose |
|:---|:---|:---|
| **Capture Date** | `payment_transaction.created_at` or Gateway Webhook timestamp | Operational date when customer paid |
| **Receipt Date (`voucher_date`)** | Server-verified receipt date provided by cashier / supervisor | Business date when funds entered ERP control |
| **Accounting Date (`entry_date`)** | Derived strictly from `voucher.voucher_date` | General Ledger period assignment |
| **Settlement Date** | Gateway bank transfer date | Date gateway payout cleared at bank |
| **Order Date** | `order.created_at` | Commercial order placement timestamp |
| **Fulfillment Date** | `order.metadata->>'inventory_fulfillment_posted_at'` | Physical dispatch timestamp (Step 4.4) |

**Failsafe Rule**: `voucher_date` must satisfy $\ge \text{accounting\_start\_date}$ and must fall within an open `accounting_fiscal_period`. Never silently backdate or substitute timestamps.

---

## 10. Idempotency Design

Every receipt and settlement operation enforces multi-layer idempotency:

1. **Database Partial Unique Index**:
   `public.accounting_voucher` enforces `idx_accounting_voucher_source_idempotency` on `(reference_type, reference_id, reference_event)` WHERE `status != 'CANCELLED' AND reference_type != 'MANUAL'`.
2. **Deterministic Source Keys**:
   - Customer Receipt:
     - `reference_type = 'PAYMENT_TRANSACTION'`
     - `reference_id = payment_transaction.id`
     - `reference_event = 'CUSTOMER_RECEIPT'`
   - Direct Order Receipt (if payment transaction not yet created):
     - `reference_type = 'ORDER'`
     - `reference_id = order.id`
     - `reference_event = 'ORDER_RECEIPT'`
   - Gateway Settlement:
     - `reference_type = 'GATEWAY_PAYOUT'`
     - `reference_id = payout_batch_id` (or `provider_ref`)
     - `reference_event = 'GATEWAY_SETTLEMENT'`
3. **Application Guard**: Re-executing an existing receipt returns `DUPLICATE_SOURCE_EVENT` or idempotent retrieval of the existing posted voucher.

---

## 11. Concurrency & Locking Design

To prevent race conditions, duplicate receipts, and database deadlocks:

1. **Strict Lock Ordering**:
   When posting a customer receipt, locks must be acquired in deterministic ascending order:
   - **Step 1**: Lock `order` row `FOR UPDATE`:
     `SELECT id, customer_id, metadata, status FROM public."order" WHERE id = $1 FOR UPDATE;`
   - **Step 2**: Lock `payment_transaction` row `FOR UPDATE` (if exists):
     `SELECT id, status, amount FROM public.payment_transaction WHERE id = $1 FOR UPDATE;`
   - **Step 3**: Lock `accounting_voucher` row `FOR UPDATE`:
     `SELECT * FROM public.accounting_voucher WHERE id = $1 FOR UPDATE;`
2. **Atomic Transaction Scope**:
   - All mutations execute inside a single transaction.
   - Caller-owned clients execute within `SAVEPOINT sp_receipt_posting`, releasing on commit and rolling back on any error.
   - Zero partial writes or leaked vouchers on validation failure.

---

## 12. Segregation of Duties (SoD) & Security Design

1. **Permission Matrix**:
   - **Draft Receipt Voucher**: Requires `PAYMENTS.RECEIVE` or `ACCOUNTING.CREATE`.
   - **Approve Receipt Voucher**: Requires `ACCOUNTING.APPROVE` via `hasEffectivePermission(actorContext, "ACCOUNTING.APPROVE")`.
   - **Post Receipt to GL**: Requires `ACCOUNTING.POST` via `hasEffectivePermission(actorContext, "ACCOUNTING.POST")`.
2. **Multi-Identity Segregation**:
   - Database constraint `chk_voucher_segregation` (`CHECK (approved_by IS NULL OR approved_by != created_by)`) strictly enforced.
   - Receipt preparer (`voucher.created_by`) cannot approve or post.
   - Receipt submitter (`voucher.submitted_by`) cannot approve or post.
   - Customer (`order.customer_id`) cannot approve or post.
   - Commercial cashier / rider cannot approve or post their own receipt.
   - Super Admin cannot self-approve if they prepared or submitted the voucher.
3. **Branch Isolation (BOLA Defense)**:
   - All operations require explicit `branch_id`.
   - Non-admin staff attempting cross-branch receipts fail closed with `BRANCH_ACCESS_DENIED`.

---

## 13. Reversal & Refund Interaction

Step 4.5 must integrate cleanly with subsequent refund and reversal lifecycles:

1. **Interaction with Sales Reversals (Step 4.7)**:
   - If an order has a `POSTED` sales voucher AND a `POSTED` receipt voucher, full sales invoice reversal **CANNOT** proceed without addressing the customer receipt.
   - The sales reversal service must detect active receipts and fail closed with `CANNOT_REVERSE_PAID_INVOICE_WITHOUT_REFUND`.
2. **Interaction with Sales Returns & Credit Notes (Step 4.6)**:
   - A Credit Note reduces Accounts Receivable (`1121`). If AR was already cleared by a receipt, the credit note creates a customer credit balance (liability), which may be settled via refund payout.
3. **Refund Accounting (Future Step)**:
   - Full/partial refund of a receipt posts:
     - Dr `1121 Accounts Receivable` (or `4190 Sales Returns`)
     - Cr `1113 Gateway Clearing` (for online refund) or Cr `1111 Cash in Hand` (for cash refund)
   - Step 4.5 will NOT implement refund logic; it only enforces clean audit linkages so future refund services can reference the original receipt.

---

## 14. Exact Files to Modify / Create in Step 4.5

### To Create:
1. `frontend/src/lib/services/customer-receipt.service.ts`:
   - Dedicated service for Customer Receipts & AR Settlement.
   - Methods:
     - `createCustomerReceiptDraft` (DRAFT `RECEIPT` voucher)
     - `submitCustomerReceipt` (SUBMITTED)
     - `approveCustomerReceipt` (APPROVED with SoD)
     - `postCustomerReceipt` (POSTED to General Ledger)
     - `postCodCashRemittance` (Branch cash remittance workflow)
     - `postGatewaySettlement` (Gateway payout & MDR fee workflow)
2. `frontend/scratch/test_step4_5_customer_receipts.js`:
   - Dedicated verification suite covering all receipt lifecycles, SoD, idempotency, mathematical balances, and rollback audits.

### To Extend:
1. `frontend/src/lib/types/accounting.types.ts`:
   - Add parameter types and DTOs: `CustomerReceiptDraftParams`, `PostCustomerReceiptParams`, `GatewaySettlementParams`.
2. `frontend/src/lib/services/sales-posting.service.ts`:
   - Add read-only helper `getOrderOutstandingBalance(orderId: string, client?: PoolClient)`.

---

## 15. Exact Tables to Modify in Step 4.5

| Table | Operation | Constraints / Columns Affected |
|:---|:---|:---|
| `public.accounting_voucher` | INSERT / UPDATE | `voucher_type = 'RECEIPT'`, `status`, `approved_by`, `posted_by`, `reference_*` |
| `public.accounting_journal_entry` | INSERT | Created by canonical `PostingService.postVoucher` (1:1 with voucher) |
| `public.accounting_journal_line` | INSERT | Lines for 1113, 1121, 1111, 1122, 1112, 5290 |
| `public.payment_transaction` | UPDATE | `status = 'captured'`, `settlement_status = 'settled'`, `metadata->>'receipt_voucher_id'` |
| `public."order"` | UPDATE | `metadata->>'payment_status'`, `metadata->>'receipt_voucher_id'`, `metadata->>'paid_at'` |

Zero schema DDL migrations required. All tables, constraints, and accounts are already in place.

---

## 16. Exact Proposed Voucher & Journal Structures

### Structure A: Prepaid Customer Receipt
```json
{
  "voucher_type": "RECEIPT",
  "voucher_date": "2026-09-26",
  "branch_id": "br_koramangala",
  "total_amount": 1050.00,
  "reference_type": "PAYMENT_TRANSACTION",
  "reference_id": "paytxn_01KYYZ...",
  "reference_event": "CUSTOMER_RECEIPT",
  "journal_lines": [
    { "account_code": "1113", "name": "Gateway Clearing", "debit": 1050.00, "credit": 0.00 },
    { "account_code": "1121", "name": "Accounts Receivable", "debit": 0.00, "credit": 1050.00 }
  ]
}
```

### Structure B: COD Cash Remittance
```json
{
  "voucher_type": "RECEIPT",
  "voucher_date": "2026-09-26",
  "branch_id": "br_koramangala",
  "total_amount": 1050.00,
  "reference_type": "ORDER",
  "reference_id": "ord_12345",
  "reference_event": "COD_RECEIPT",
  "journal_lines": [
    { "account_code": "1111", "name": "Cash in Hand", "debit": 1050.00, "credit": 0.00 },
    { "account_code": "1122", "name": "Undeposited COD", "debit": 0.00, "credit": 1050.00 }
  ]
}
```

### Structure C: Gateway Payout Settlement (with MDR Fee)
```json
{
  "voucher_type": "RECEIPT",
  "voucher_date": "2026-09-26",
  "branch_id": "br_koramangala",
  "total_amount": 1050.00,
  "reference_type": "GATEWAY_PAYOUT",
  "reference_id": "payout_batch_9876",
  "reference_event": "GATEWAY_SETTLEMENT",
  "journal_lines": [
    { "account_code": "1112", "name": "Bank Operating A/c", "debit": 1029.00, "credit": 0.00 },
    { "account_code": "5290", "name": "Payment Gateway MDR Fees", "debit": 21.00, "credit": 0.00 },
    { "account_code": "1113", "name": "Gateway Clearing", "debit": 0.00, "credit": 1050.00 }
  ]
}
```

---

## 17. Failure Cases & Guard Rails

| Failure Scenario | Detection Point | Error Code | System Action |
|:---|:---|:---|:---|
| Receipt amount exceeds open AR | Pre-draft validation | `OVERPAYMENT_NOT_PERMITTED` | Rejects mutation; transaction rolls back |
| Attempt to receipt unposted order | Pre-draft validation | `ORDER_NOT_POSTED` | Rejects receipt until sales invoice is posted |
| Duplicate receipt callback | Idempotency guard | `DUPLICATE_SOURCE_EVENT` | Fails closed or returns existing voucher |
| Preparer self-approval | Approval guard | `SEGREGATION_OF_DUTIES_VIOLATION` | Blocked by DB constraint & app logic |
| Customer approves receipt | Approval guard | `SEGREGATION_OF_DUTIES_VIOLATION` | Fails closed |
| Missing `ACCOUNTING.POST` | Posting guard | `PERMISSION_DENIED` | Fails closed |
| Unconfigured accounting start date | Posting guard | `ACCOUNTING_START_DATE_NOT_CONFIGURED` | Fails closed |
| Unconfigured fiscal period | Posting guard | `FISCAL_PERIOD_NOT_CONFIGURED` | Fails closed |
| Inactive GL account | Account validation | `POSTING_ACCOUNT_INVALID` | Fails closed; atomic rollback |
| Cross-branch receipt attempt | BOLA defense | `BRANCH_ACCESS_DENIED` | Fails closed |
| Historical prototype order receipt | Quarantine guard | `LEGACY_PROTOTYPE_ORDER_REJECTED` | Fails closed |

---

## 18. Comprehensive Test Plan for Step 4.5

A dedicated test suite `frontend/scratch/test_step4_5_customer_receipts.js` will verify:
1. **Database Baseline Pre-Audit**: Verify all 18 PostgreSQL baseline checks.
2. **Prepaid Customer Receipt Lifecycle**:
   - DRAFT $\rightarrow$ SUBMITTED $\rightarrow$ APPROVED $\rightarrow$ POSTED.
   - Verify Debit 1113 Gateway Clearing = Credit 1121 Accounts Receivable.
   - Verify customer AR balance reduced to zero.
3. **COD Cash Remittance Lifecycle**:
   - Verify Debit 1111 Cash in Hand = Credit 1122 Undeposited COD.
   - Verify Account 1122 balance reduced to zero.
4. **Gateway Payout & MDR Expense Settlement**:
   - Verify compound entry: Dr 1112 Bank Operating A/c + Dr 5290 MDR Fees = Cr 1113 Gateway Clearing.
   - Verify exact paise balance across 3 accounts.
5. **Partial Receipts & Outstanding Balance Tracking**:
   - Partial receipt (e.g. ₹500 on ₹1,050 invoice); verify remaining outstanding is ₹550.
   - Second receipt (₹550); verify remaining outstanding is ₹0.
6. **Overpayment Prevention**:
   - Attempting receipt > outstanding balance rejected with `OVERPAYMENT_NOT_PERMITTED`.
7. **Segregation of Duties (SoD)**:
   - Preparer cannot approve or post (`SEGREGATION_OF_DUTIES_VIOLATION`).
   - Customer cannot approve or post (`SEGREGATION_OF_DUTIES_VIOLATION`).
   - Super Admin cannot self-approve (`SEGREGATION_OF_DUTIES_VIOLATION`).
8. **Permission Enforcement**:
   - Staff lacking `ACCOUNTING.APPROVE` or `ACCOUNTING.POST` rejected with `PERMISSION_DENIED`.
9. **Historical Quarantine Protection**:
   - Attempting receipt on historical order rejected with `LEGACY_PROTOTYPE_ORDER_REJECTED`.
10. **Fail-Closed Cut-off Guards**:
    - Reject when `accounting_start_date` is unconfigured.
    - Reject when `accounting_fiscal_period` is 0 rows.
11. **Idempotency & Concurrency**:
    - Duplicate callback with identical source event rejected with `DUPLICATE_SOURCE_EVENT`.
12. **Atomic Rollback & Baseline Verification**:
    - Injected failure triggers full transaction rollback; verify database returns to exact baseline.

---

## 19. Explicit List of Things NOT to Implement in Step 4.5

To maintain rigid architectural boundaries, the following are strictly **OUT OF SCOPE** for Step 4.5:
1. ❌ **Do NOT implement customer refunds or credit note payouts** (Deferred to Step 4.6 / Step 4.7).
2. ❌ **Do NOT implement bank statement import or automated bank feed scraping** (Deferred to Treasury / Bank Reconciliation module).
3. ❌ **Do NOT implement internal Cash-to-Bank Contra deposits** (Contra vouchers are separate treasury operations).
4. ❌ **Do NOT implement multi-currency FX revaluation** (CakeToHome operates exclusively in INR).
5. ❌ **Do NOT configure `accounting_start_date` in `public.setting`** (Must remain unconfigured).
6. ❌ **Do NOT create production fiscal periods in `public.accounting_fiscal_period`** (Must remain 0 rows).
7. ❌ **Do NOT backfill or migrate historical orders or historical payment transactions** (Must remain 100% quarantined).
8. ❌ **Do NOT create a second accounting state machine or bypass canonical `PostingService`**.

---

## 20. Database Baseline Verification

Live PostgreSQL verification performed on 2026-09-26:

| Table / Setting | Baseline Target | Actual Verified Value | Status |
|:---|:---:|:---:|:---:|
| `public.accounting_account` | 98 | 98 | ✅ PASS |
| `public.accounting_voucher` | 0 | 0 | ✅ PASS |
| `public.accounting_journal_entry` | 0 | 0 | ✅ PASS |
| `public.accounting_journal_line` | 0 | 0 | ✅ PASS |
| `public.accounting_fiscal_period` | 0 | 0 | ✅ PASS |
| `public.purchase` | 0 | 0 | ✅ PASS |
| `public.purchase_item` | 0 | 0 | ✅ PASS |
| `public.purchase_payment` | 0 | 0 | ✅ PASS |
| `public.supplier` | 0 | 0 | ✅ PASS |
| `public.branch` | 57 | 57 | ✅ PASS |
| `public.branch_inventory` | 424 | 424 | ✅ PASS |
| `public.inventory_cost_lot` | 0 | 0 | ✅ PASS |
| `public.inventory_movement` | 0 | 0 | ✅ PASS |
| `public.inventory_cost_consumption` | 0 | 0 | ✅ PASS |
| `public.order` | 173 | 173 | ✅ PASS |
| `public.payment_transaction` | 53 | 53 | ✅ PASS |
| `public.setting` (`accounting_start_date`) | 0 rows (UNCONFIGURED) | 0 rows (UNCONFIGURED) | ✅ PASS |
| Synthetic non-acc rows in `branch_inventory` | 0 | 0 | ✅ PASS |

**Independent Baseline Result**: 18 / 18 PASSED (0 FAILED).
Live database is verified pristine and ready for bounded Step 4.5 review.

---

## 21. Next Authorization Boundary

> [!IMPORTANT]
> **PHASE 4F STEP 4.5 FORENSIC & DESIGN GATE IS COMPLETE.**
> 
> - **Actual schema and payment lifecycles inspected and documented**.
> - **All 6 Chart of Accounts accounts (1111, 1112, 1113, 1121, 1122, 5290) verified active**.
> - **Double-entry structures, date semantics, idempotency, and SoD rules designed**.
> - **Database baseline 100% verified (18/18 checks pass)**.
> - **Zero feature code implemented; zero accounting data mutated**.
> 
> **ABSOLUTE STOP CONDITION REACHED.**
> Awaiting user review and authorization before starting implementation of Phase 4F Step 4.5.
