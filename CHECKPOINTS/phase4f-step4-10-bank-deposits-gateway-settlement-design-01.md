# CakeToHome ERP — Phase 4F Step 4.10 Forensic & Architectural Design Checkpoint
## Bank Deposits, Payment Gateway Payout Settlements, MDR Accounting & Multi-Branch Treasury Control
### Milestone: `PHASE-4F-STEP-4.10-BANK-DEPOSITS-GATEWAY-SETTLEMENT-DESIGN-01`
### Gate Classification: READ-ONLY DISCOVERY — IMPLEMENT NOTHING

---

## 1. Executive Summary

This document constitutes the formal **Forensic & Architectural Design Gate** for **Phase 4F Step 4.10: Bank Deposits & Payment Gateway Payout Settlements** of the CakeToHome ERP platform.

In strict compliance with the **Absolute Governance Rule**:
- **Zero application code was modified or added.**
- **Zero database DDL, schema changes, or migrations were executed.**
- **Zero production or historical data was mutated.**
- **Zero accounting vouchers, journal entries, or ledger accounts were created.**
- **Zero test fixtures or synthetic transactions were persisted.**
- **Zero Git commits or pushes were made.**
- **Step 4.10 implementation remains strictly NOT STARTED.**

### Core Forensic Discoveries
1. **CoA Bank Topology**:
   - Account `1112 Bank Operating A/c` is currently the **only bank account** in the 98-account Chart of Accounts.
   - The CoA is a global corporate master without `branch_id` or `company_id` columns on `accounting_account`.
   - All multi-branch isolation is enforced downstream via `branch_id NOT NULL` foreign keys on `accounting_voucher` and `accounting_journal_line`.
   - There is currently **zero bank master table** (no entity stores bank name, account number, IFSC code, or branch bank mappings).
2. **Payment Gateway Integration**:
   - `Razorpay` is the sole online gateway actively integrated into checkout and customer order creation (`/payments/razorpay/create-order`, `/payments/razorpay/verify-signature`).
   - `public.payment_transaction` is an operational table with 15 columns; it stores `amount` as integer and tracks `status` and `settlement_status`, but possesses **no columns for fees, taxes, payout IDs, settlement batch IDs, or metadata**.
   - All 53 rows in `public.payment_transaction` are quarantined historical prototype records (`LEGACY_PROTOTYPE_DATA`).
3. **MDR & GST Treatment**:
   - Account `5290 Payment Gateway MDR Fees` exists under Operating Expenses `5200`.
   - Account `5310 Bank Charges & Processing Fees` exists under Finance Costs `5300`.
   - Step 4.5 introduced a prototype method `CustomerReceiptService.postGatewaySettlement` enforcing `net + mdr === gross`.
   - However, current code **ignores GST on MDR** (SAC 997159 18% GST), booking 100% of deductions to expense without Input Tax Credit (ITC) splitting (`1143/1144` or `1146`), or risks fabricating tax without provider tax invoice evidence.
4. **Cash Drawer Deposits**:
   - Currently, **zero cash deposit architecture exists**. Cash accumulated in `1111 Cash in Hand` from COD settlements sits indefinitely in the branch drawer. There is no deposit slip tracking, bank acknowledgement reference, or transit clearing mechanism.
5. **Segregation of Duties (SoD) Defect in Existing Prototype**:
   - In Step 4.5, `CustomerReceiptService.postGatewaySettlement` hardcodes an artificial supervisor persona (`usr_settlement_supervisor`) to bypass voucher approval. This violates the core accounting rule that `SUPER_ADMIN` and automated routines must never bypass independent 3-tier SoD.

---

## 2. Actual Database State

Direct read-only inspection of the live PostgreSQL database (`cakes2home`) established the following factual state:

### A. Core Baseline Metrics (Pristine Audit: 18/18 Verified)
- `accounting_account`: **98**
- `accounting_voucher`: **0**
- `accounting_journal_entry`: **0**
- `accounting_journal_line`: **0**
- `accounting_fiscal_period`: **0**
- `purchase`: **0**
- `purchase_item`: **0**
- `purchase_payment`: **0**
- `supplier`: **0**
- `branch`: **57**
- `branch_inventory`: **424**
- `inventory_cost_lot`: **0**
- `inventory_movement`: **0**
- `inventory_cost_consumption`: **0**
- `order`: **173** (Historical prototype data)
- `payment_transaction`: **53** (Historical prototype data)
- `setting` (`accounting_start_date`): **0** (Unconfigured)
- Synthetic non-accounting rows: **0**

### B. Relational Tables Inspection
A search across `information_schema.tables` for names matching `%bank%`, `%settle%`, `%payout%`, or `%deposit%` returned:
$$\mathbf{0 \text{ tables found}}$$
There are no tables for:
- Bank accounts master
- Bank deposit slips
- Gateway payout batches
- Settlement transaction lines
- Bank reconciliation statements

---

## 3. Actual Code & Architecture State

### A. Existing Accounting Engine
The canonical posting engine established in Steps 4.1–4.9 consists of:
1. **`PostingService` (`frontend/src/lib/services/posting.service.ts`)**:
   - Manages the strict 7-stage voucher lifecycle: `DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `POSTED` (or `CANCELLED`).
   - Enforces pre-flight guards: Accounting start date configured, fiscal period active and unlocked, posting accounts active/non-group, balanced double-entry ($\sum \text{Dr} = \sum \text{Cr} > 0$), and single-sided lines ($\text{Dr} > 0 \oplus \text{Cr} > 0$).
   - Atomic database transaction with deferred balancing trigger (`trg_check_journal_balance`).
2. **`CustomerReceiptService` (`frontend/src/lib/services/customer-receipt.service.ts`)**:
   - Implements customer receipts for prepaid orders (`Dr 1113 Gateway Clearing / Cr 1121 Accounts Receivable`).
   - Implements single-order COD remittance (`Dr 1111 Cash in Hand / Cr 1122 Undeposited COD`).
   - Implements batch/shift rider settlements (`Dr 1111 / Cr 1122 x N`).
   - Contains a prototype gateway settlement helper (`postGatewaySettlement`).
3. **`CodCollectionService` & `CodCollectionRepository`**:
   - Manages Model B doorstep collection events, frozen custody snapshots (`order.metadata.cod_custody_event`), and multi-state Account 1122 subledger.

---

## 4. Chart of Accounts (CoA) Topology

### A. Relevant Cash, Bank, Clearing, Fee & Tax Accounts
All 98 accounts in `public.accounting_account` were analyzed. The following accounts constitute the liquid asset, clearing, expense, and tax framework:

| Account Code | Account Name | Type | Level | Is Group | Parent Code | Parent Name | Status |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| **`1110`** | Cash and Cash Equivalents | `ASSET` | 2 | **Yes** | `1100` | Current Assets | Active |
| **`1111`** | Cash in Hand | `ASSET` | 3 | No | `1110` | Cash and Cash Equivalents | Active |
| **`1112`** | Bank Operating A/c | `ASSET` | 3 | No | `1110` | Cash and Cash Equivalents | Active |
| **`1113`** | Gateway Clearing | `ASSET` | 3 | No | `1110` | Cash and Cash Equivalents | Active |
| **`1114`** | Petty Cash - Branches | `ASSET` | 3 | No | `1110` | Cash and Cash Equivalents | Active |
| **`1119`** | Unclassified Suspense | `ASSET` | 3 | No | `1110` | Cash and Cash Equivalents | Active |
| **`1120`** | Receivables and Advances | `ASSET` | 2 | **Yes** | `1100` | Current Assets | Active |
| **`1121`** | Accounts Receivable | `ASSET` | 3 | No | `1120` | Receivables and Advances | Active |
| **`1122`** | Undeposited COD | `ASSET` | 3 | No | `1120` | Receivables and Advances | Active |
| **`1140`** | Duties & Taxes - Input Tax Credit | `ASSET` | 2 | **Yes** | `1100` | Current Assets | Active |
| **`1143`** | Input CGST 9.0% (Accessories/General) | `ASSET` | 3 | No | `1140` | Duties & Taxes - Input Tax Credit | Active |
| **`1144`** | Input SGST 9.0% (Accessories/General) | `ASSET` | 3 | No | `1140` | Duties & Taxes - Input Tax Credit | Active |
| **`1146`** | Input IGST 18.0% (Interstate Accessories) | `ASSET` | 3 | No | `1140` | Duties & Taxes - Input Tax Credit | Active |
| **`2110`** | Trade Payables | `LIABILITY` | 2 | **Yes** | `2100` | Current Liabilities | Active |
| **`2111`** | Accounts Payable | `LIABILITY` | 3 | No | `2110` | Trade Payables | Active |
| **`5200`** | Operating Expenses | `EXPENSE` | 2 | **Yes** | `5000` | Expenses | Active |
| **`5290`** | Payment Gateway MDR Fees | `EXPENSE` | 3 | No | `5200` | Operating Expenses | Active |
| **`5295`** | Cash Rounding / Variance | `EXPENSE` | 3 | No | `5200` | Operating Expenses | Active |
| **`5300`** | Finance Costs | `EXPENSE` | 2 | **Yes** | `5000` | Expenses | Active |
| **`5310`** | Bank Charges & Processing Fees | `EXPENSE` | 3 | No | `5300` | Finance Costs | Active |

### B. Critical CoA Observations
1. **Single Bank GL Account**: Only code `1112` exists. There are no sub-accounts for different banks (e.g. HDFC, ICICI, SBI).
2. **No Transit Account**: There is no dedicated `1118 Cash in Transit / Deposit in Transit` account. Only `1119 Unclassified Suspense` exists.
3. **No Inter-Branch Transfer Accounts**: There are no accounts for `2190 Due to Branches` or `1190 Due from Branches`.
4. **GST Input Accounts Exist for 18% Services**: Accounts `1143` (CGST 9%), `1144` (SGST 9%), and `1146` (IGST 18%) exist, although their descriptive names currently reference "Accessories/General".

---

## 5. Bank Account Findings

1. **Absence of Bank Master Entities**:
   - The database does not track physical bank accounts (account number, bank name, branch name, IFSC, account type).
   - In existing Step 4.5 and test suites, transactions simply post to `1112` with a narration string.
2. **Dimensional Multi-Branch Behavior**:
   - `accounting_journal_line` enforces `branch_id NOT NULL`.
   - Therefore, when posting to `1112`, every debit or credit is tagged with the voucher's `branch_id`.
   - A single GL account `1112` can track multi-branch balances through the `branch_id` dimension on lines.
3. **Enterprise Reality**:
   - In a multi-branch retail network, either:
     - All branches deposit cash into a single central corporate bank account (tagged with deposit slips and branch IDs).
     - Each branch maintains a local collection account with a regional bank branch, which is periodically swept to corporate HQ.

---

## 6. Payment / Gateway Schema Findings

### A. Table Structure: `public.payment_transaction`
```sql
Table "public.payment_transaction"
       Column       |           Type           | Nullable |   Default   
--------------------+--------------------------+----------+-------------
 id                 | text                     | not null | 
 company_id         | text                     |          | 
 branch_id          | text                     | not null | 
 order_id           | text                     | not null | 
 customer_id        | text                     | not null | 
 amount             | integer                  | not null | 
 currency           | text                     | not null | 
 idempotency_key    | text                     |          | 
 status             | text                     | not null | 'pending'
 settlement_status  | text                     | not null | 'unsettled'
 provider           | text                     | not null | 'cod'
 provider_ref       | text                     |          | 
 created_at         | timestamp with time zone | not null | now()
 updated_at         | timestamp with time zone | not null | now()
 deleted_at         | timestamp with time zone |          | 
Indexes:
    "payment_transaction_pkey" PRIMARY KEY, btree (id)
    "IDX_payment_transaction_deleted_at" btree (deleted_at) WHERE deleted_at IS NULL
    "idx_payment_transaction_idempotency" btree (idempotency_key) WHERE deleted_at IS NULL AND idempotency_key IS NOT NULL
    "idx_payment_transaction_order_id" btree (order_id) WHERE deleted_at IS NULL
Constraints:
    "payment_transaction_pkey" PRIMARY KEY (id)
```

### B. Distinct Values in Prototype Data (53 Rows)
- `provider`: `['card', 'cod', 'upi']`
- `status`: `['captured', 'partially_refunded', 'pending', 'refunded']`
- `settlement_status`: `['pending', 'settled', 'unsettled']`
- `amount`: Stored as integer (e.g. 1500, 2500). In CakeToHome order models, order amounts are in whole INR rupees (₹1,500.00).

### C. Missing Gateway Settlement Fields
`public.payment_transaction` lacks:
- `payout_id` / `settlement_batch_id`
- `settled_at` timestamp
- `fee_amount` (MDR deducted for this transaction)
- `tax_amount` (GST on MDR deducted for this transaction)
- `net_settled_amount`
- `settlement_voucher_id` (accounting link)
- `metadata` or `data` JSON column

---

## 7. Existing Payment Provider Findings

1. **Razorpay**:
   - The frontend checkout explicitly integrates Razorpay (`RazorpayPaymentGatewayIntegration` in `frontend/src/lib/api-engine.ts` lines 22509–22565).
   - Checkout uses `createRazorpayOrder` and `verifyRazorpaySignature`.
   - Customer payment triggers `POST /api/v1/payments/verify` which creates `payment_transaction` with `status = 'captured'` and `provider_ref = razorpay_payment_id`.
2. **Other Gateways**:
   - Stripe, PayU, Cashfree, and PhonePe appear only in comments or enum type strings; **zero functional code or API client exists** for them.
3. **Payout Webhooks**:
   - There are **no webhook handlers** for Razorpay payout events (e.g. `payout.processed`, `settlement.processed`).

---

## 8. Existing Settlement Findings

In Step 4.5, `CustomerReceiptService.postGatewaySettlement` was created as an initial prototype:
```typescript
// Compound Settlement Journal (Step 4.5 prototype):
Dr 1112 Bank Operating A/c            ₹9,764.00 (Net bank credit)
Dr 5290 Payment Gateway MDR Fees        ₹236.00 (MDR fee)
Cr 1113 Gateway Clearing             ₹10,000.00 (Gross clearing credit)
```

### Deficiencies Identified in Step 4.5 Prototype:
1. **Hardcoded Supervisor**: Line 1788 sets `const supervisorId = "usr_settlement_supervisor"` to approve vouchers internally. This is an SoD violation that must be replaced by explicit human/system actor context.
2. **Zero Tax Splitting**: Deductions are credited 100% to `5290`, ignoring GST and ITC.
3. **No Settlement Batch Data Model**: It accepts arbitrary numbers and an unverified array of `paymentTxnIds`.
4. **No Transaction Reconciliation**: It does not verify that the sum of transactions equals `grossAmount`.
5. **No Branch Validation**: It does not check whether transactions belong to the settlement voucher's `branchId`.

---

## 9. MDR (Merchant Discount Rate) Findings

1. **Dynamic Real-World Nature**:
   - Payment aggregators do not charge a single flat rate.
   - UPI: Often 0% or flat nominal fee.
   - RuPay Debit: Often 0% or capped.
   - Mastercard/Visa Debit: 0.4% to 0.9%.
   - Credit Cards: 1.5% to 2.5%.
   - Corporate/Amex: Up to 3.0%.
   - NetBanking: Flat ₹10 to ₹25 per transaction.
2. **Accounting Invariant**:
   - **MDR must never be inferred, estimated, or fabricated by fixed percentage calculation.**
   - MDR must be recorded strictly from the provider's authoritative payout advice/settlement report.
   - Account `5290 Payment Gateway MDR Fees` is an expense account.

---

## 10. GST on Gateway Charges Findings

### A. Regulatory Context (Indian GST)
- Payment aggregators operate under SAC code **997159** (Payment and settlement services).
- Their services attract **18% GST** (9% CGST + 9% SGST for intra-state, or 18% IGST for inter-state).
- CakeToHome is eligible to claim Input Tax Credit (ITC) on these charges against its output GST liabilities (`2121`, `2122`, `2125`).

### B. Authoritative Evidence Requirement
To uphold the **No Fabrication Principle**, the ERP must enforce the following rule:

> **ITC Claim Invariant**: Input GST on gateway fees can ONLY be booked to ITC accounts (`1143/1144` or `1146`) if backed by authoritative provider tax invoice evidence containing:
> 1. Provider's valid GSTIN
> 2. Tax Invoice Number
> 3. Invoice Date
> 4. Taxable Value & Tax Rate (18%)
> 5. Exact CGST/SGST or IGST tax amounts

### C. Fallback Handling when Tax Invoice is Absent
If an aggregator payout statement lists only total fee deduction without an authoritative tax invoice:
- **Treatment A (Total Fee as Expense)**: The entire deduction is booked to `5290 Payment Gateway MDR Fees` (zero ITC claimed until the monthly GST invoice is reconciled).
- **Treatment B (Unreconciled Fee Suspense)**: The fee is split into taxable base in `5290` and tax in `1119 Unclassified Suspense` pending monthly GSTR-2B matching.
- **Forbidden**: Inventing synthetic CGST/SGST line items without provider invoice evidence.

---

## 11. Cash Drawer $\to$ Bank Deposit Findings

### A. Current Status
- Branch cash collected under Step 4.9 accumulates in `1111 Cash in Hand`.
- There is no application service or database model to deposit cash into `1112 Bank Operating A/c`.

### B. Required Information for Cash Deposit
A valid commercial cash deposit requires:
1. `branch_id`: Originating physical branch
2. `cashier_id`: Staff depositing cash
3. `bank_account_id` / `bank_name`: Target deposit account
4. `deposit_slip_no`: Physical deposit slip / counterfoil reference
5. `deposit_date`: Date cash was deposited
6. `bank_value_date`: Date credited on bank statement
7. `amount`: Exact cash deposited
8. `currency`: Default `'INR'`
9. `acknowledgement_ref`: Bank teller stamp / CDM transaction ID / UTR
10. `denomination_breakdown`: Optional JSON tracking note counts (e.g. 500x10, 200x5)

---

## 12. Multi-Branch Banking Findings

### A. Corporate vs. Branch Flow Comparison
```text
Cash Collections (Doorstep COD):
Physical Cash → Branch Drawer (1111 Branch A) → Local Bank Deposit → Bank A/c (1112 Branch A)

Online Collections (Razorpay UPI/Card):
Website Checkout → Gateway Clearing (1113 Branch A) → Razorpay Central Settlement → Corporate Bank A/c (1112 HQ)
```

### B. The Branch Boundary Problem
When Razorpay settles a batch of ₹50,000:
- ₹30,000 originated from orders fulfilled by **Branch A** (`1113 Branch A` has Dr ₹30,000).
- ₹20,000 originated from orders fulfilled by **Branch B** (`1113 Branch B` has Dr ₹20,000).
- The bank deposit of ₹48,820 (net of ₹1,180 fees) hits the **Corporate Headquarters Account**.

If a single voucher is posted with `branch_id = HQ`:
- Cr `1113` for ₹30,000 would carry `branch_id = Branch A`.
- Cr `1113` for ₹20,000 would carry `branch_id = Branch B`.
- Dr `1112` for ₹48,820 would carry `branch_id = HQ`.
- Dr `5290` for ₹1,180 would carry `branch_id = HQ` or split.

**Result**: Journal lines would have mismatched branches!
In Step 4.8, `accounts-receivable.service.ts` flagged `BRANCH_MISMATCH` whenever line `branch_id` did not match voucher `branch_id`.

**Architectural Solution**:
Settlement must either:
- **Approach 1 (Branch-Segmented Vouchers)**: Generate branch-level settlement vouchers, so each voucher balances within its branch.
- **Approach 2 (Treasury Clearing Journal)**: Use a corporate treasury model where online sales clearing is owned by Corporate HQ, or inter-branch settlement entries balance the branches.

---

## 13. Security, RBAC & Segregation of Duties (SoD) Findings

### A. Current Permissions Matrix (`staff-access-control.ts`)
Only 4 generic accounting permissions exist:
- `ACCOUNTING.VIEW`: Read-only ledger inspection
- `ACCOUNTING.POST`: Manual posting of journals
- `ACCOUNTING.APPROVE`: Voucher approval
- `ACCOUNTING.EXPORT`: Report downloads

### B. Proposed Step 4.10 SoD Matrix
To maintain GAAP/IFRS controls:

| Role / Action | Cashier / Teller | Branch Supervisor | GL Accountant | Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Cash Deposit Draft** | ✅ Prepare | ❌ | ❌ | ❌ |
| **Cash Deposit Verify/Approve** | ❌ (No self-approval) | ✅ Approve | ❌ | ❌ |
| **Cash Deposit Post to GL** | ❌ (No self-posting) | ❌ (No approver-posting) | ✅ Post to 1112 | ❌ (No bypass) |
| **Gateway Settlement Prepare** | ❌ | ✅ Prepare | ❌ | ❌ |
| **Gateway Settlement Approve** | ❌ | ❌ (No self-approval) | ✅ Verify & Approve | ❌ |
| **Gateway Settlement Post** | ❌ | ❌ | ✅ Post to 1112 | ❌ (No bypass) |

---

## 14. Settlement Reconciliation Findings

### A. Gateway Clearing Reconciliation Invariant
For any settlement period:
$$\begin{aligned}
\text{Total Online Orders Invoiced} &= \text{Posted Debits to Account 1113} \\
\text{Total Settled Payouts} &= \text{Posted Credits to Account 1113} \\
\mathbf{\text{Uncleared Gateway Balance}} &= \sum \text{Debits} - \sum \text{Credits} = \text{GL Account 1113 Net Balance}
\end{aligned}$$

Every rupee remaining in `1113` must match an active `payment_transaction` where `settlement_status = 'unsettled'`.

### B. Expected Settlement Calculation Formula (Design Only)
$$\text{Expected Payout Amount} = \sum \text{Eligible Transactions} - \sum \text{Approved Refunds} - \text{Authoritative MDR} - \text{Authoritative GST} \pm \text{Documented Adjustments}$$

---

## 15. Identified Gaps

1. **No Bank Account Master Table**: No relational table to manage bank accounts, IFSC, and branch linkages.
2. **No Cash Deposit Entity or Voucher Type**: No mechanism to transition cash from `1111` to `1112`.
3. **No Payout Batch Entity**: No table linking `payment_transaction` rows to payout vouchers.
4. **Missing Fee/Tax Columns on `payment_transaction`**: Cannot store per-transaction MDR or GST.
5. **No Input GST on MDR in Existing Prototype**: Step 4.5 books 100% of fees to expense, losing ITC.
6. **Hardcoded Supervisor in Step 4.5 Prototype**: `usr_settlement_supervisor` violates SoD.
7. **No Deposit-in-Transit Tracking**: No mechanism to handle cash dropped at bank but uncredited until next day.
8. **No Multi-Branch Gateway Settlement Policy**: No defined rule for splitting multi-branch payouts.
9. **No Settlement Variance Exception Types**: No error codes for fee mismatches, short settlements, or chargeback deductions.
10. **Absence of Specific Permissions**: No granular permissions for bank deposit or gateway reconciliation.

---

## 16. Identified Risks

1. **Multi-Branch Imbalance Risk**: Attempting a compound cross-branch voucher violates single-branch voucher integrity.
2. **Tax Fraud / Disallowance Risk**: Claiming ITC without provider tax invoices violates GST Section 16(2) of the CGST Act.
3. **Double Settlement Risk**: Processing a payout report twice without cryptographic idempotency duplicates bank debits.
4. **Unreconciled Variance Risk**: Forcing clearing entries to balance by plugging differences into arbitrary accounts.
5. **SoD Circumvention Risk**: Allowing the cashier who deposits cash to approve or post the bank voucher.

---

## 17. Unknown / Missing Evidence

1. **Provider Tax Invoices**: The system has no records or storage of actual Razorpay monthly GST invoices.
2. **Actual Bank Accounts in Operation**: Unknown whether CakeToHome operates 1 central bank account or regional branch accounts.
3. **Chargeback / Dispute Policy**: No documented business rule for how chargeback deductions should be accounted for (Receivable from customer vs Operating loss).

---

## 18. Design Alternatives

### A. Bank Account Topology
- **Option 1 (Single Global 1112 with Branch Dimensions)**:
  - Keep `1112` as the only bank GL account; differentiate branches via `journal_line.branch_id`.
  - *Pros*: Zero CoA changes; fully compatible with existing 98 accounts.
  - *Cons*: Cannot distinguish multiple physical bank accounts.
- **Option 2 (Relational Bank Master Table `bank_account` + Mapped GL 1112)**:
  - Add `public.bank_account` master table. Store `bank_account_id` in voucher/journal metadata while posting to GL `1112`.
  - *Pros*: Professional ERP standard; supports multiple physical bank accounts without CoA explosion.
  - *Cons*: Requires a new master table when implementation is authorized.
- **Option 3 (CoA Account Explosion)**:
  - Create `1112.01`, `1112.02`, etc. for each bank and branch.
  - *Pros*: Explicit GL codes.
  - *Cons*: Severe ledger bloat; violates clean CoA principles.

### B. Cash Deposit Workflow
- **Alternative A (Direct Contra Voucher `Dr 1112 / Cr 1111`)**:
  - Single-stage deposit. Cashier prepares, supervisor approves with deposit slip, accountant posts upon bank acknowledgement.
  - *Pros*: Fits existing voucher workflow; zero new accounts needed.
  - *Cons*: Assumes same-day bank credit.
- **Alternative B (Two-Stage Transit `1111 -> Deposit in Transit -> 1112`)**:
  - Requires creating a new GL account `1118 Deposit in Transit`.
  - *Pros*: Tracks cash while physically with courier/transit.
  - *Cons*: Requires CoA modification; unnecessary complexity for retail branches banking locally.

### C. Gateway Settlement Multi-Branch Model
- **Model A (Branch-Level Settlement Batches)**:
  - Settlement service partitions the provider payout into branch-level batches. Each branch gets an independent voucher balancing within that branch.
  - *Pros*: 100% compliant with existing branch validation and zero `BRANCH_MISMATCH`.
  - *Cons*: Requires splitting one bank statement credit across multiple vouchers.
- **Model B (Central Treasury HQ Voucher with Inter-Branch Lines)**:
  - Voucher belongs to HQ branch; requires Inter-Branch Clearing accounts.
  - *Pros*: Matches single bank credit on bank statement.
  - *Cons*: Requires new CoA accounts and complex inter-branch reconciliations.

---

## 19. Recommended Design for Review

Antigravity recommends the following unified architecture for Step 4.10:

1. **Bank Topology**: **Option 2 (Bank Account Master + Global GL 1112)**
   - Introduce `public.bank_account` master table when authorized.
   - All deposits and settlements post to GL `1112 Bank Operating A/c` with `bank_account_id` preserved in metadata.
2. **Cash Drawer Deposits**: **Alternative A (Direct Contra Voucher with 3-Tier SoD)**
   - Cashier prepares `PAYMENT` or `CONTRA` voucher with `deposit_slip_no` and physical acknowledgement attachment.
   - Branch Supervisor verifies cash count and slip, approving voucher.
   - GL Accountant posts voucher upon bank credit verification:
     $$\text{Dr 1112 Bank Operating A/c} \quad / \quad \text{Cr 1111 Cash in Hand}$$
3. **Gateway Payout Settlements**: **Model A (Branch-Partitioned Settlement)**
   - Provider payout reports (Razorpay) are partitioned by `payment_transaction.branch_id`.
   - Each branch voucher posts:
     $$\begin{aligned}
     \text{Dr 1112 Bank Operating A/c} &\quad (\text{Net branch payout}) \\
     \text{Dr 5290 Payment Gateway MDR Fees} &\quad (\text{Branch MDR expense}) \\
     \text{Dr 1143/1144 Input GST (Optional)} &\quad (\text{Only if tax invoice provided}) \\
     \text{Cr 1113 Gateway Clearing} &\quad (\text{Gross branch collections})
     \end{aligned}$$
4. **GST on MDR Policy**: **Strict Evidence-Based ITC**
   - If provider invoice is attached: Split 18% GST into `1143/1144` (or `1146`).
   - If provider invoice is absent: Book 100% of deduction to `5290` without tax fabrication.
5. **SoD Integrity**:
   - Eliminate hardcoded `usr_settlement_supervisor`.
   - Require real authenticated session contexts with `ACCOUNTING.APPROVE` and `ACCOUNTING.POST`.

---

## 20. Explicit Business Decisions Required Before Implementation

Prior to authorizing Step 4.10 implementation, management/accounting authority must lock:

1. **Bank Account Structure**: Does CakeToHome operate one centralized corporate bank account (e.g. HDFC HQ) for all branches, or do branches have local bank accounts?
2. **Gateway Multi-Branch Settlement Policy**: Shall gateway payouts be recorded as branch-partitioned vouchers (Model A) or centralized treasury vouchers?
3. **MDR Input GST Policy**: Shall MDR deductions without formal tax invoices be expensed in full to `5290`, or held in suspense?
4. **Cash Deposit Slip Mandatory Fields**: Is denomination breakdown (note count) mandatory for cash deposit approval?
5. **Settlement Variance Tolerance**: Is any automated variance write-off permitted (e.g. $\le ₹1.00$ to `5295 Cash Rounding / Variance`), or must every single rupee of variance fail closed?
6. **New Permissions Approval**: Shall dedicated permissions (`BANK.DEPOSIT`, `GATEWAY.SETTLE`) be added, or shall existing `ACCOUNTING.POST` / `ACCOUNTING.APPROVE` be reused?

---

## 21. Proposed Future Data Model (DESIGN ONLY — NOT CREATED)

When implementation is authorized, the following schemas are proposed:

```sql
-- DESIGN PROPOSAL ONLY — DO NOT EXECUTE
CREATE TABLE public.bank_account (
    id TEXT PRIMARY KEY DEFAULT ('bnk_' || substr(md5(random()::text), 1, 16)),
    bank_name VARCHAR(100) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    masked_account_number VARCHAR(20) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    branch_id TEXT REFERENCES public.branch(id) ON DELETE RESTRICT,
    gl_account_id TEXT NOT NULL REFERENCES public.accounting_account(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE public.gateway_payout_batch (
    id TEXT PRIMARY KEY DEFAULT ('pout_' || substr(md5(random()::text), 1, 16)),
    provider VARCHAR(50) NOT NULL,
    payout_ref VARCHAR(100) NOT NULL UNIQUE,
    bank_account_id TEXT REFERENCES public.bank_account(id),
    payout_date DATE NOT NULL,
    value_date DATE NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    gross_amount NUMERIC(15,2) NOT NULL,
    mdr_amount NUMERIC(15,2) NOT NULL,
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(15,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    voucher_id TEXT REFERENCES public.accounting_voucher(id),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
```

---

## 22. Proposed Future Voucher Flows (DESIGN ONLY)

### Flow 1: Cash Drawer Deposit
```text
[Cash Drawer 1111] 
       ↓ (Cashier prepares deposit slip)
[Voucher: DRAFT, type=CONTRA, ref=DEPOSIT_SLIP_123]
       ↓ (Supervisor inspects slip & cash counterfoil)
[Voucher: APPROVED]
       ↓ (Accountant verifies bank acknowledgement/CDM receipt)
[Voucher: POSTED]
       ↓
Dr 1112 Bank Operating A/c
Cr 1111 Cash in Hand
```

### Flow 2: Gateway Payout Settlement
```text
[Gateway Provider Settlement Report]
       ↓ (System parses batch, transactions & fee invoice)
[Voucher: DRAFT, type=RECEIPT, ref=RZP_POUT_456]
       ↓ (Supervisor/Accountant reconciles gross, fees, net)
[Voucher: APPROVED]
       ↓ (GL Accountant posts to Ledger)
[Voucher: POSTED]
       ↓
Dr 1112 Bank Operating A/c            (Net bank deposit)
Dr 5290 Payment Gateway MDR Fees      (Processing fee)
Dr 1143/1144 Input GST                (If tax invoice provided)
Cr 1113 Gateway Clearing              (Gross transaction total)
```

---

## 23. Proposed Idempotency Model

1. **Cash Deposit Idempotency**:
   - Natural unique key: `(CASH_DEPOSIT, branch_id, deposit_slip_no)`
   - Replay protection: Submitting the same `deposit_slip_no` for the same branch returns the existing voucher.
2. **Gateway Payout Idempotency**:
   - Natural unique key: `(GATEWAY_PAYOUT, provider, payout_ref)`
   - Replay protection: Submitting the same `payout_ref` returns the existing voucher and prevents duplicate bank debits.

---

## 24. Proposed Exception Model

| Exception Code | Trigger Condition | Severity | Action |
| :--- | :--- | :---: | :--- |
| `SETTLEMENT_MATH_MISMATCH` | `net + mdr + tax != gross` | `CRITICAL` | Block voucher creation fail-closed |
| `UNMATCHED_SETTLEMENT_TRANSACTION` | Payout contains order not found in `payment_transaction` | `HIGH` | Quarantine transaction into exception log |
| `DUPLICATE_PAYOUT_REFERENCE` | `payout_ref` already posted in GL | `HIGH` | Return existing voucher (`wasDuplicate=true`) |
| `BRANCH_MISMATCH_SETTLEMENT` | Settlement batch contains transactions from conflicting branch | `HIGH` | Block posting; require branch partitioning |
| `UNAUTHORIZED_DEPOSIT_ATTEMPT` | Cashier attempting to deposit to unassigned bank account | `MEDIUM` | Block with `BRANCH_ACCESS_DENIED` |
| `FEE_INVOICE_MISSING_FOR_ITC` | Input GST claimed without tax invoice number & GSTIN | `MEDIUM` | Block ITC line; book 100% to expense or reject |

---

## 25. Proposed Segregation of Duties Matrix

- **Rule 1 (No Self-Approval)**: `voucher.created_by !== voucher.approved_by`.
- **Rule 2 (No Self-Posting)**: `voucher.created_by !== voucher.posted_by`.
- **Rule 3 (No Approver-Posting)**: `voucher.approved_by !== voucher.posted_by`.
- **Rule 4 (Super Admin Non-Bypass)**: `SUPER_ADMIN` identity cannot perform 2 stages on the same voucher.

---

## 26. Security & BOLA Model

- All bank accounts, deposit slips, and payout batches are bounded by server-side `branch_id`.
- Staff tokens with `branchId = null` are rejected (`BRANCH_ACCESS_DENIED`).
- Staff tokens attempting cross-branch deposit or settlement are rejected (`BRANCH_ACCESS_DENIED`).
- Only `SUPER_ADMIN` or corporate treasury role can access enterprise-aggregate bank views.

---

## 27. Migration Considerations (DESIGN ONLY)

When Step 4.10 is authorized:
- No existing columns in `public.accounting_account`, `public.order`, or `public.branch` will be dropped.
- New tables (`bank_account`, `gateway_payout_batch`) will be additive only.
- Historical prototype data (`payment_transaction` 53 rows) will remain untouched and quarantined (`LEGACY_PROTOTYPE_DATA`).

---

## 28. Testing Strategy (DESIGN ONLY)

The future Step 4.10 test suite will execute inside atomic rollback transactions verifying:
1. Direct cash deposit lifecycle (`1111 -> 1112`) with slip references.
2. Gateway settlement lifecycle (`1113 -> 1112 + 5290`) with exact transaction allocations.
3. ITC split vs 100% expense fallback for MDR fees.
4. Idempotency on duplicate slip and payout numbers.
5. 3-tier SoD violation rejections.
6. Multi-branch isolation and BOLA defense.
7. Discrepancy scanner for unallocated `1113` clearing balances.
8. Multi-client concurrent isolation and pristine 18/18 post-test DB baseline.

---

## 29. Database Baseline Verification

PostgreSQL baseline verified immediately before and after this forensic discovery:
- Table count `public.accounting_account`: **98**
- Table count `public.accounting_voucher`: **0**
- Table count `public.accounting_journal_entry`: **0**
- Table count `public.accounting_journal_line`: **0**
- Table count `public.accounting_fiscal_period`: **0**
- Table count `public.purchase`: **0**
- Table count `public.supplier`: **0**
- Table count `public.branch`: **57**
- Table count `public.branch_inventory`: **424**
- Table count `public.inventory_cost_lot`: **0**
- Table count `public.inventory_movement`: **0**
- Table count `public.inventory_cost_consumption`: **0**
- Table count `public.order`: **173**
- Table count `public.payment_transaction`: **53**
- Setting `accounting_start_date`: **0** rows
- **Baseline Audit Result: 18/18 PASSED (100% PRISTINE)**

---

## 30. Git State

- **Current HEAD Commit**: `f7d9a47073d64b0da305cc537a6eccb45938fd1b` (Authored Sat Sep 19 20:33:06 2026 by `alexclicks15-lab`).
- **Working Tree**: Pre-existing uncommitted modifications from Steps 4.1–4.9 remain preserved in the working tree.
- **Step 4.10 Changes**: **0 commits, 0 pushes**.

---

## 31. Scope Boundary

- **Step 4.9**: **FROZEN**
- **Step 4.10**: **DESIGN COMPLETE — IMPLEMENTATION NOT STARTED**
- **Step 4.11+**: **NOT STARTED**

---

## 32. Final Gate Status

```text
STEP 4.10 FORENSIC & ARCHITECTURAL DESIGN GATE
STATUS: DESIGN COMPLETE — IMPLEMENTATION NOT AUTHORIZED

STEP 4.10 IMPLEMENTATION:
NOT STARTED

DATABASE MUTATIONS:
0

MIGRATIONS:
0

COMMITS:
0

PUSHES:
0
```
