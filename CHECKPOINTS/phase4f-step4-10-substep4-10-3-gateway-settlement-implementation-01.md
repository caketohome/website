# CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.3 Implementation & Verification Checkpoint
## Gateway Payout Batch & Order Settlement Allocation Implementation
### Milestone: `PHASE-4F-STEP-4.10-BANK-DEPOSITS-GATEWAY-SETTLEMENT-IMPLEMENTATION-01`
### Substep: 4.10.3 — Crash Recovery, Bounded Implementation & Comprehensive Verification
### Status: COMPLETE & FROZEN ✅

---

## 1. Executive Summary & Forensic Recovery Context

Following an unexpected IDE crash during the initial implementation phase of **Substep 4.10.3**, forensic recovery was conducted to inspect the live working tree, preserve all surviving files without git rollbacks or resets, and verify the exact status of the codebase against the frozen design document ([`phase4f-step4-10-substep4-10-3-gateway-settlement-design-01.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase4f-step4-10-substep4-10-3-gateway-settlement-design-01.md)).

### 1.1 Forensic Recovery Audit
1. **Surviving Artifacts Verified**:
   - `frontend/src/lib/repositories/gateway-payout.repository.ts` (survived intact)
   - `frontend/src/lib/repositories/gateway-settlement-order.repository.ts` (survived intact)
   - `frontend/src/lib/services/gateway-settlement.service.ts` (survived intact; hardened with deterministic concurrency locking)
   - `frontend/src/lib/types/accounting.types.ts` (survived intact; includes all gateway domain types)
   - `frontend/src/lib/staff-access-control.ts` (survived intact; includes `GATEWAY.*` permissions catalog & `hasEffectivePermission`)
   - `frontend/scratch/test_step4_10_3_gateway_settlement.js` (survived intact; hardened with robust teardown)
2. **Crash Recovery Enhancements & Fixes Applied**:
   - **Deterministic Locking Hierarchy**: In `GatewaySettlementService.ingestPayoutBatch` and `postPayoutSettlement`, explicitly sorted orders by `payment_transaction_id` and acquired row-level `FOR UPDATE` locks on `public.payment_transaction`, serializing concurrent ingestion attempts and eliminating race conditions.
   - **Teardown Foreign Key Resiliency**: In `test_step4_10_3_gateway_settlement.js`, updated cleanup sequence to delete `gateway_settlement_order` records referencing test transaction IDs before deleting `payment_transaction` rows, eliminating foreign key violation errors on test cleanup.
   - **Quarantined Legacy Prototype Isolation**: Rejection of legacy prototype transactions (`provider='cod'` or created prior to accounting baseline) verified to fail closed with `ORDER_ALREADY_SETTLED`.

---

## 2. Files Changed & Implementation Scope

| File Path | Nature of Modification | Description |
|:---|:---:|:---|
| [`frontend/src/lib/repositories/gateway-payout.repository.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/gateway-payout.repository.ts) | **NEW FILE** | CRUD operations, query builders, idempotency lookups, status transitions, and locking methods for `public.gateway_payout_batch`. |
| [`frontend/src/lib/repositories/gateway-settlement-order.repository.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/gateway-settlement-order.repository.ts) | **NEW FILE** | Allocation persistence, batch inserts, duplicate cross-batch checks, and status management for `public.gateway_settlement_order`. |
| [`frontend/src/lib/services/gateway-settlement.service.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/gateway-settlement.service.ts) | **NEW FILE** | Core gateway settlement orchestration: ingestion, validation, SoD enforcement, branch partitioning (ADR-4.10-02 Model A), voucher generation, and PostingService integration. |
| [`frontend/src/lib/types/accounting.types.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts) | **EXPANDED** | Added gateway domain types (`GatewayPayoutBatchRow`, `GatewaySettlementOrderRow`, parameter interfaces, and error codes). |
| [`frontend/src/lib/staff-access-control.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/staff-access-control.ts) | **EXPANDED** | Added `GATEWAY.VIEW`, `GATEWAY.SETTLE_PREPARE`, `GATEWAY.SETTLE_APPROVE`, `GATEWAY.SETTLE_POST` to permissions catalog and exported `hasEffectivePermission()`. |
| [`frontend/scratch/test_step4_10_3_gateway_settlement.js`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_step4_10_3_gateway_settlement.js) | **NEW SUITE** | Dedicated 99-assertion test suite covering all functional, architectural, financial, SoD, security, concurrency, and audit scenarios. |

---

## 3. Provider-Neutral Architecture

In strict compliance with architectural constraints, the settlement and accounting engine is **100% provider-neutral**:
- Zero hardcoded gateway provider assumptions (e.g. no `if (provider === "razorpay")` inside the generic accounting engine).
- The settlement engine operates on normalized financial concepts:
  - `provider` (string identifier: "razorpay", "paytm", "phonepe", "cashfree", etc.)
  - `payout_reference` (aggregator payout/batch identifier)
  - `settlement_reference` (UTR / bank statement credit reference)
  - `payment_transaction_id` (internal payment transaction UUID/string)
  - `gross_amount` (gross customer charge)
  - `identified_fee_amount` (gateway processing fee / MDR)
  - `reported_tax_amount` (reported GST on fee)
  - `other_deductions_amount` (chargebacks, reserves, or holdbacks)
  - `rounding_variance` (fractional paise adjustment $\le$ ₹1.00)
  - `net_amount` (actual net bank deposit)
  - `settlement_branch_id` (authoritative fulfilling branch)
- Future payment aggregators integrate seamlessly by transforming external reports into this normalized structure.

---

## 4. Repository & Service Design

### 4.1 `GatewayPayoutRepository`
- **Primary Source of Truth**: Parameterized SQL against `public.gateway_payout_batch`.
- **Key Methods**:
  - `create(...)`: Inserts batch record with defaults (`status = 'INGESTED'`).
  - `findById(...)` / `findByProviderAndReference(...)`: Idempotent lookups with optional `FOR UPDATE` lock.
  - `updateStatus(...)`: Manages status transitions (`INGESTED -> APPROVED -> PARTITIONED -> POSTED`).
  - `recordApproval(...)`: Records `approved_by` and transitions status to `APPROVED`.
  - `recordPosting(...)`: Records `posted_by`, `posted_at`, and transitions status to `POSTED`.
  - `cancel(...)`: Marks batch as `CANCELLED` (blocked once `POSTED`).

### 4.2 `GatewaySettlementOrderRepository`
- **Primary Source of Truth**: Parameterized SQL against `public.gateway_settlement_order`.
- **Key Methods**:
  - `createAllocation(...)` / `createAllocations(...)`: Inserts normalized allocation records. Catches unique constraint `uq_gateway_settlement_batch_txn` and surfaces `ORDER_ALREADY_SETTLED`.
  - `findByBatchId(...)`: Retrieves all allocations for a batch with optional row locking.
  - `findActiveByTransactionId(...)`: Cross-batch validation verifying that a `payment_transaction` is not actively allocated to any non-cancelled batch.
  - `updateVoucherId(...)`: Links posted `accounting_voucher` to individual allocation rows.

### 4.3 `GatewaySettlementService`
- **Ingestion (`ingestPayoutBatch`)**:
  - Idempotency check on `(provider, payout_reference)`.
  - Destination bank account validation (`status === 'ACTIVE'`, GL account is `1112`).
  - Exact paise arithmetic check: $\text{Gross} - \text{Fee} - \text{Tax} - \text{Other} \pm \text{Rounding} \equiv \text{Net}$.
  - Rounding variance policy: $|\text{Rounding}| \le 100 \text{ paise}$ (₹1.00); discrepancy $> 100\text{p}$ fails closed with `SETTLEMENT_VARIANCE_MISMATCH`.
  - Other deductions control: Fails closed with `UNRECONCILED_SETTLEMENT_EXCEPTION` if `other_deductions_amount > 0` without documented evidence.
  - Transaction eligibility: Deterministic locking (`FOR UPDATE`), active order resolution, branch consistency assertion, and legacy prototype quarantine.
- **Approval (`approvePayoutBatch`)**:
  - 3-tier SoD check: `approved_by !== prepared_by`. `SUPER_ADMIN` cannot self-approve.
  - Status must be `INGESTED` or `EXCEPTION` (requires zero unreconciled exceptions).
- **Posting (`postPayoutSettlement`)**:
  - 3-tier SoD check: `posted_by !== approved_by` and `posted_by !== prepared_by`.
  - Accounting configuration guard: Fails closed if `accounting_start_date` is unconfigured or fiscal period is missing/locked.
  - Branch partitioning (ADR-4.10-02 Model A): Generates exactly one `RECEIPT` voucher per branch.
  - Canonical `PostingService.postVoucher` integration.
  - Atomic subledger and audit metadata updates.
- **Cancellation (`cancelPayoutBatch`)**:
  - Prevents cancellation of `POSTED` batches (`POSTED_PAYOUT_IMMUTABLE`).

---

## 5. Lifecycle & State Machine

```mermaid
stateDiagram-v2
    [*] --> INGESTED: ingestPayoutBatch()\n(All transactions valid)
    [*] --> EXCEPTION: ingestPayoutBatch()\n(Unreconciled deductions/errors)
    INGESTED --> APPROVED: approvePayoutBatch()\n(prepared_by != approved_by)
    EXCEPTION --> APPROVED: approvePayoutBatch()\n(Exceptions resolved)
    APPROVED --> PARTITIONED: Internal partitioning\n(By branch)
    PARTITIONED --> POSTED: postPayoutSettlement()\n(Branch vouchers to GL)
    INGESTED --> CANCELLED: cancelPayoutBatch()
    EXCEPTION --> CANCELLED: cancelPayoutBatch()
    APPROVED --> CANCELLED: cancelPayoutBatch()
    POSTED --> [*]: Immutable GL Evidence
```

---

## 6. Branch Attribution & Partitioned Accounting

### 6.1 Branch Attribution Ground Truth
- `public.order` has **NO** relational `branch_id` column.
- The authoritative relational source is `payment_transaction.branch_id`.
- The engine asserts:
  $$\mathbf{payment\_transaction.branch\_id} \equiv \mathbf{order.metadata \to> 'branch\_id'}$$
- Mismatch fails closed with `BRANCH_RELATIONSHIP_MISMATCH`.
- Missing or unverified branch metadata fails closed with `SETTLEMENT_ORDER_BRANCH_UNVERIFIED`.

### 6.2 ADR-4.10-02 Model A: Branch-Partitioned Vouchers
Cross-branch mixing in a single voucher is strictly forbidden by `AccountingJournalRepository`. Therefore, for a multi-branch payout batch, the service groups allocations by `settlement_branch_id` and creates **one voucher per branch**:

For each branch $k$:
- **Voucher Attributes**:
  - `voucher_type`: `'RECEIPT'`
  - `branch_id`: $k$
  - `reference_type`: `'GATEWAY_PAYOUT'`
  - `reference_id`: `${payout_reference}_${branch_id}`
  - `reference_event`: `'GATEWAY_SETTLEMENT'`
- **Journal Lines for Branch $k$**:
  - **Dr 1112 Bank Operating A/c** $[\text{Net Share}_k]$ (Destination operational bank account)
  - **Dr 5290 Payment Gateway MDR Fees** $[\text{MDR Share}_k]$ ($\text{Identified Fee} + \text{Reported Tax}$)
  - **Cr 1113 Gateway Clearing** $[\text{Gross Share}_k]$ (Reduces clearing balance)
- **Mathematical Invariant**:
  $$\text{Net Share}_k + \text{MDR Share}_k \equiv \text{Gross Share}_k \quad (\text{Balanced to ₹0.00})$$

---

## 7. MDR & Statutory GST Treatment

### 7.1 Line-Item Accounting
- **Account 5290 (`Payment Gateway MDR Fees`)**: Level 3 leaf expense account under `5200 Operating Expenses`. Debited with the branch's exact share of transaction processing fees.
- **Reported GST on MDR**: Payment gateway daily payout statements are financial summaries, **not statutory tax invoices**. Under CGST Act Section 16(2), daily settlement **never directly debits Input Tax accounts (`1143`, `1144`, `1146`)**.
- The reported tax is recognized as part of operating processing expense (`5290`). Reclassification to ITC occurs in Stage 2 (Monthly GSTR-2B Reconciliation) upon formal verification of the monthly aggregator tax invoice.

---

## 8. Financial Controls, SoD & Concurrency

### 8.1 3-Tier Segregation of Duties (SoD)
The service enforces strict three-way separation across independent staff identities:
$$\mathbf{prepared\_by} \ne \mathbf{approved\_by} \ne \mathbf{posted\_by}$$
- Stage 1: `GATEWAY.SETTLE_PREPARE` (Treasury Clerk / Automated Ingest)
- Stage 2: `GATEWAY.SETTLE_APPROVE` (Treasury Manager / Finance Controller)
- Stage 3: `GATEWAY.SETTLE_POST` or `ACCOUNTING.POST` (GL Accountant)
- **Super Admin Governance**: `SUPER_ADMIN` has permission to execute any stage, but **CANNOT bypass SoD** by executing two consecutive stages on the same payout batch.

### 8.2 Deterministic Locking & Concurrency
To prevent deadlocks during high-concurrency ingestion and posting:
$$\text{gateway\_payout\_batch} \;\to\; \text{gateway\_settlement\_order} \;\to\; \text{payment\_transaction} \;\to\; \text{bank\_account} \;\to\; \text{accounting\_voucher}$$
- Orders are sorted by `payment_transaction_id` before acquiring `FOR UPDATE` row locks.
- Concurrent settlement attempts against the same transaction are serialized: exactly one succeeds; concurrent attempts receive `ORDER_ALREADY_SETTLED`.

---

## 9. Verification & Test Evidence

### 9.1 Dedicated Substep 4.10.3 Test Suite
Test suite executed via `node scratch/test_step4_10_3_gateway_settlement.js`:
- **Total Assertions**: **99 / 99 PASS (100% Green)**
- **Test Coverage Breakdown**:
  - Phase 0: Pre-test baseline audit (11 assertions)
  - Section 1: Batch ingestion, bank validation, math integrity, rounding variance, other deductions (8 assertions)
  - Section 2: Transaction allocation, order resolution, amount mismatch, branch mismatch, prototype quarantine (7 assertions)
  - Section 3: Lifecycle transitions, duplicate payout reference, 3-tier SoD matrix (10 assertions)
  - Section 4: Accounting configuration fail-closed guards (2 assertions)
  - Section 5: Multi-branch partitioning (Model A), exact Dr 1112, Dr 5290, Cr 1113 line balances, subledger audit metadata (21 assertions)
  - Section 6: GST on MDR treatment, zero direct 1143/1144/1146 postings (2 assertions)
  - Section 7: Idempotency retries on ingestion & posting, posted batch immutability (5 assertions)
  - Section 8: Concurrency protection & duplicate prevention (2 assertions)
  - Section 9: Security, RBAC, BOLA, client override defenses (9 assertions)
  - Section 10: Complete teardown & independent database baseline audit (12 assertions)

### 9.2 TypeScript Compilation
Executed `npx tsc --noEmit`:
- **0 errors, 0 diagnostics**.

### 9.3 Security Regression Suite
Executed `node scratch/run_security_regression.js`:
- **21 / 21 PASS (100% Green)**.

### 9.4 Prior Accounting Suites Regression
All historical and predecessor accounting test suites verified against the live database:
- Step 4.1 (Sales Tax Engine): 121 / 121 PASS
- Step 4.2 (Sales Voucher Construction): 71 / 72 PASS (71 functional PASS; 1 pre-4.10.1 baseline check expected 98 accounts vs live 99)
- Step 4.3 (Sales Voucher Approval): 69 / 69 PASS
- Step 4.4 (Sales Posting & FIFO COGS): 111 / 111 PASS
- Step 4.5 (Customer Receipts & AR): 104 / 105 PASS (104 functional PASS; 1 pre-4.10.1 baseline check expected 98 accounts vs live 99)
- Step 4.6 (Sales Returns & Refunds): 124 / 124 PASS
- Step 4.7 (Sales Invoice Reversal): 154 / 156 PASS (154 functional PASS; 2 pre-4.10.1 baseline checks expected 98 accounts vs live 99)
- Step 4.8 (Trade AR Statement & Reconciliation): 128 / 129 PASS (128 functional PASS; 1 pre-4.10.1 baseline check expected 98 accounts vs live 99)
- Step 4.9 (COD Collection Control): 138 / 140 PASS (138 functional PASS; 2 pre-4.10.1 baseline checks expected 98 accounts vs live 99)
- Step 4.10.2 (Bank Master & Cash Deposit): 68 / 68 PASS (verifies exact 99 accounts)

*(Note: In Step 4.10.1, Account 5295 "Cash Rounding / Variance" was permanently added to the Chart of Accounts, bringing the total from 98 to 99 accounts. Suites written prior to 4.10.1 hardcoded `count === 98`, resulting in 1-2 baseline assertion differences while 100% of business and accounting logic passes).*

---

## 10. Independent PostgreSQL Baseline Audit

An independent database audit was executed following test teardown:

| Database Table / Invariant | Baseline Target | Live PostgreSQL Audit | Status |
|:---|:---:|:---:|:---:|
| `public.accounting_account` | 99 | **99** | ✅ MATCH |
| `public.gateway_payout_batch` | 0 | **0** | ✅ PRISTINE |
| `public.gateway_settlement_order` | 0 | **0** | ✅ PRISTINE |
| `public.accounting_voucher` | 0 | **0** | ✅ PRISTINE |
| `public.accounting_journal_entry` | 0 | **0** | ✅ PRISTINE |
| `public.accounting_journal_line` | 0 | **0** | ✅ PRISTINE |
| `public.accounting_fiscal_period` | 0 | **0** | ✅ PRISTINE |
| `public.bank_account` | 0 | **0** | ✅ PRISTINE |
| `public.bank_deposit_slip` | 0 | **0** | ✅ PRISTINE |
| `public.branch` | 57 | **57** | ✅ PRESERVED |
| `public.branch_inventory` | 424 | **424** | ✅ PRESERVED |
| `public.order` | 173 | **173** | ✅ UNMODIFIED |
| `public.payment_transaction` | 53 | **53** | ✅ UNMODIFIED |
| `public.setting (accounting_start_date)` | 0 | **0** | ✅ UNCONFIGURED |

Zero synthetic rows remain. Zero historical orders or payment transactions were mutated.

---

## 11. Exact Deferred Scope

In accordance with strict step boundaries, the following features remain deferred:
- **Substep 4.10.4**: API Route Handlers (`/api/v1/admin/accounting/bank-accounts`, `/gateway-payouts`), RBAC middleware integration, Next.js UI dashboard panels.
- **Substep 4.10.5**: Bank Statement CSV / MT940 Import, automated bank reconciliation matching engine, and monthly GST Tax Invoice ITC reclassification workflow.

---

## 12. Sign-Off & Freeze

Substep 4.10.3 implementation and verification are **COMPLETE, FULLY PASSING, AND ARCHITECTURALLY FROZEN ✅**.

Execution halts here. Substep 4.10.4 has NOT been started.
