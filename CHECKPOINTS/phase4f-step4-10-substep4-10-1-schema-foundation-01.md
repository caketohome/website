# CakeToHome ERP — Phase 4F Step 4.10 Substep 4.10.1 Checkpoint
## Implementation Preflight & Additive Schema Foundation
### Milestone: `PHASE-4F-STEP-4.10-BANK-DEPOSITS-GATEWAY-SETTLEMENT-IMPLEMENTATION-01`
### Substep: 4.10.1 — Additive Schema Foundation & Type Definitions

---

## 1. Authorization Statement

Implementation was formally authorized for **Substep 4.10.1 ONLY** under the milestone `PHASE-4F-STEP-4.10-BANK-DEPOSITS-GATEWAY-SETTLEMENT-IMPLEMENTATION-01`.

The authorization explicitly mandated:
- Preflight baseline verification.
- Additive schema migration for Account `1118 Deposit in Transit` under `1110 Cash & Cash Equivalents`.
- Additive relational schema creation for `bank_account`, `bank_deposit_slip`, `gateway_payout_batch`, and `gateway_settlement_order`.
- TypeScript domain types in `frontend/src/lib/types/accounting.types.ts`.
- Zero service/repository implementation.
- Zero financial posting workflows.
- Zero mutation of historical orders, payments, stock, or accounting vouchers.

---

## 2. Pre-Migration Baseline (18/18 Pristine)

Before any schema mutation or file edits, an independent PostgreSQL audit was executed:

```text
=== INDEPENDENT POSTGRESQL BASELINE AUDIT ===
[PASS] [1/18] accounting_account: 98 (expected 98)
[PASS] [2/18] accounting_voucher: 0 (expected 0)
[PASS] [3/18] accounting_journal_entry: 0 (expected 0)
[PASS] [4/18] accounting_journal_line: 0 (expected 0)
[PASS] [5/18] accounting_fiscal_period: 0 (expected 0)
[PASS] [6/18] purchase: 0 (expected 0)
[PASS] [7/18] purchase_item: 0 (expected 0)
[PASS] [8/18] purchase_payment: 0 (expected 0)
[PASS] [9/18] supplier: 0 (expected 0)
[PASS] [10/18] branch: 57 (expected 57)
[PASS] [11/18] branch_inventory: 424 (expected 424)
[PASS] [12/18] inventory_cost_lot: 0 (expected 0)
[PASS] [13/18] inventory_movement: 0 (expected 0)
[PASS] [14/18] inventory_cost_consumption: 0 (expected 0)
[PASS] [15/18] order: 173 (expected 173)
[PASS] [16/18] payment_transaction: 53 (expected 53)
[PASS] [17/18] accounting_start_date: 0 (expected 0)
[PASS] [18/18] synthetic accounting rows: 0 (expected 0)

PRE-MIGRATION BASELINE STATUS: 18/18 PASSED (100% PRISTINE)
```

---

## 3. Migration Performed

The additive migration script [`frontend/migrate_phase4f_step4_10_schema.js`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase4f_step4_10_schema.js) was executed within an atomic `BEGIN ... COMMIT` block.

Operations performed:
1. Checked parent account `1110 Cash and Cash Equivalents` (`id: '5ca4950b-0617-4969-adc3-bbfb7797fe19'`).
2. Inserted additive leaf account `1118 Deposit in Transit` under `1110`.
3. Created table `public.bank_account` with check constraints and branch foreign key.
4. Created table `public.bank_deposit_slip` with check constraints, foreign keys, and 3-tier SoD rules.
5. Created table `public.gateway_payout_batch` with unique provider payout reference constraint, check constraints, foreign keys, and 3-tier SoD rules.
6. Created table `public.gateway_settlement_order` with allocation uniqueness, foreign keys, and non-negativity constraints.
7. Verified post-migration invariants before issuing `COMMIT`.

---

## 4. Account 1118 Verification

Account `1118` was verified in `public.accounting_account`:
- **ID**: `acc_1118_deposit_in_transit`
- **Code**: `1118`
- **Name**: `Deposit in Transit`
- **Type**: `ASSET`
- **Subtype**: `CURRENT_ASSET`
- **Parent ID**: `5ca4950b-0617-4969-adc3-bbfb7797fe19` (resolves to `1110 Cash and Cash Equivalents`)
- **Level**: `4` (Child leaf of Level 3 group `1110`)
- **Is Group**: `false`
- **Is Active**: `true`
- **Is System**: `true`
- **Description**: `Branch cash drawer deposits dispatched but pending bank acknowledgement`
- **Metadata**: `{"subledger": "DEPOSIT_IN_TRANSIT"}`

---

## 5. `bank_account` Schema

Table: `public.bank_account`

| Column | Type | Nullable | Default | Constraints / References |
|---|---|---|---|---|
| `id` | `TEXT` | `NO` | — | `PRIMARY KEY` |
| `company_id` | `TEXT` | `NO` | `'company_default'` | — |
| `branch_id` | `TEXT` | `YES` | `NULL` | `REFERENCES branch(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| `bank_name` | `TEXT` | `NO` | — | `CHECK (length(trim(bank_name)) > 0)` |
| `account_number_masked` | `TEXT` | `NO` | — | `CHECK (length(trim(account_number_masked)) >= 4)` |
| `ifsc_code` | `TEXT` | `NO` | — | `CHECK (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$')` |
| `status` | `TEXT` | `NO` | `'ACTIVE'` | `CHECK (status IN ('ACTIVE', 'INACTIVE', 'FROZEN'))` |
| `metadata` | `JSONB` | `YES` | `'{}'::jsonb` | — |
| `created_at` | `TIMESTAMPTZ` | `NO` | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | `NO` | `NOW()` | — |

**Indexes**:
- `idx_bank_account_branch_id` on `(branch_id)`
- `idx_bank_account_status` on `(status)`

---

## 6. `bank_deposit_slip` Schema

Table: `public.bank_deposit_slip`

| Column | Type | Nullable | Default | Constraints / References |
|---|---|---|---|---|
| `id` | `TEXT` | `NO` | — | `PRIMARY KEY` |
| `slip_number` | `TEXT` | `NO` | — | `UNIQUE` |
| `company_id` | `TEXT` | `NO` | `'company_default'` | — |
| `branch_id` | `TEXT` | `NO` | — | `REFERENCES branch(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| `bank_account_id` | `TEXT` | `NO` | — | `REFERENCES bank_account(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| `deposit_date` | `DATE` | `NO` | — | — |
| `amount` | `NUMERIC(15,2)` | `NO` | — | `CHECK (amount > 0)` |
| `denominations` | `JSONB` | `NO` | `'{}'::jsonb` | — |
| `status` | `TEXT` | `NO` | `'DRAFT'` | `CHECK (status IN ('DRAFT', 'DISPATCHED', 'CONFIRMED', 'REJECTED', 'CANCELLED'))` |
| `prepared_by` | `TEXT` | `NO` | — | — |
| `approved_by` | `TEXT` | `YES` | `NULL` | — |
| `posted_by` | `TEXT` | `YES` | `NULL` | — |
| `bank_ref_number` | `TEXT` | `YES` | `NULL` | — |
| `bank_value_date` | `DATE` | `YES` | `NULL` | — |
| `transit_voucher_id`| `TEXT` | `YES` | `NULL` | `REFERENCES accounting_voucher(id) ON UPDATE CASCADE ON DELETE SET NULL` |
| `credit_voucher_id` | `TEXT` | `YES` | `NULL` | `REFERENCES accounting_voucher(id) ON UPDATE CASCADE ON DELETE SET NULL` |
| `metadata` | `JSONB` | `YES` | `'{}'::jsonb` | — |
| `created_at` | `TIMESTAMPTZ` | `NO` | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | `NO` | `NOW()` | — |

**Check Constraints (SoD Enforcement)**:
- `chk_bank_deposit_sod_preparer_approver`: `CHECK (approved_by IS NULL OR prepared_by <> approved_by)`
- `chk_bank_deposit_sod_preparer_poster`: `CHECK (posted_by IS NULL OR prepared_by <> posted_by)`
- `chk_bank_deposit_sod_approver_poster`: `CHECK (approved_by IS NULL OR posted_by IS NULL OR approved_by <> posted_by)`

**Indexes**:
- `idx_bank_deposit_slip_branch` on `(branch_id)`
- `idx_bank_deposit_slip_bank_account` on `(bank_account_id)`
- `idx_bank_deposit_slip_status` on `(status)`
- `idx_bank_deposit_slip_date` on `(deposit_date)`

---

## 7. `gateway_payout_batch` Schema

Table: `public.gateway_payout_batch`

| Column | Type | Nullable | Default | Constraints / References |
|---|---|---|---|---|
| `id` | `TEXT` | `NO` | — | `PRIMARY KEY` |
| `company_id` | `TEXT` | `NO` | `'company_default'` | — |
| `provider` | `TEXT` | `NO` | `'razorpay'` | — |
| `payout_reference` | `TEXT` | `NO` | — | `UNIQUE (provider, payout_reference)` |
| `settlement_reference`| `TEXT` | `YES` | `NULL` | — |
| `bank_account_id` | `TEXT` | `NO` | — | `REFERENCES bank_account(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| `settlement_date` | `DATE` | `NO` | — | — |
| `bank_value_date` | `DATE` | `YES` | `NULL` | — |
| `gross_amount` | `NUMERIC(15,2)` | `NO` | — | `CHECK (gross_amount >= 0)` |
| `identified_fee_amount`| `NUMERIC(15,2)`| `NO` | `0.00` | `CHECK (identified_fee_amount >= 0)` |
| `reported_tax_amount` | `NUMERIC(15,2)`| `NO` | `0.00` | `CHECK (reported_tax_amount >= 0)` |
| `other_deductions_amount`| `NUMERIC(15,2)`| `NO` | `0.00` | `CHECK (other_deductions_amount >= 0)` |
| `net_amount` | `NUMERIC(15,2)` | `NO` | — | `CHECK (net_amount >= 0)` |
| `rounding_variance` | `NUMERIC(6,2)` | `NO` | `0.00` | — |
| `currency` | `TEXT` | `NO` | `'INR'` | — |
| `status` | `TEXT` | `NO` | `'INGESTED'` | `CHECK (status IN ('INGESTED', 'APPROVED', 'PARTITIONED', 'POSTED', 'EXCEPTION', 'CANCELLED'))` |
| `unreconciled_exception_count` | `INT` | `NO` | `0` | `CHECK (unreconciled_exception_count >= 0)` |
| `ingestion_source` | `TEXT` | `NO` | `'MANUAL_IMPORT'` | — |
| `prepared_by` | `TEXT` | `NO` | — | — |
| `approved_by` | `TEXT` | `YES` | `NULL` | — |
| `posted_by` | `TEXT` | `YES` | `NULL` | — |
| `posted_at` | `TIMESTAMPTZ` | `YES` | `NULL` | — |
| `metadata` | `JSONB` | `YES` | `'{}'::jsonb` | — |
| `created_at` | `TIMESTAMPTZ` | `NO` | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | `NO` | `NOW()` | — |

**Check Constraints (SoD Enforcement)**:
- `chk_payout_sod_preparer_approver`: `CHECK (approved_by IS NULL OR prepared_by <> approved_by)`
- `chk_payout_sod_preparer_poster`: `CHECK (posted_by IS NULL OR prepared_by <> posted_by)`
- `chk_payout_sod_approver_poster`: `CHECK (approved_by IS NULL OR posted_by IS NULL OR approved_by <> posted_by)`

**Indexes**:
- `idx_gateway_payout_provider` on `(provider)`
- `idx_gateway_payout_status` on `(status)`
- `idx_gateway_payout_date` on `(settlement_date)`
- `idx_gateway_payout_bank_account` on `(bank_account_id)`

---

## 8. `gateway_settlement_order` Schema

Table: `public.gateway_settlement_order`

| Column | Type | Nullable | Default | Constraints / References |
|---|---|---|---|---|
| `id` | `TEXT` | `NO` | — | `PRIMARY KEY` |
| `payout_batch_id` | `TEXT` | `NO` | — | `REFERENCES gateway_payout_batch(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| `payment_transaction_id`| `TEXT` | `NO` | — | `REFERENCES payment_transaction(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| `order_id` | `TEXT` | `NO` | — | `REFERENCES "order"(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| `settlement_branch_id`| `TEXT` | `NO` | — | `REFERENCES branch(id) ON UPDATE CASCADE ON DELETE RESTRICT` |
| `allocated_gross_amount`| `NUMERIC(15,2)`| `NO` | — | `CHECK (allocated_gross_amount >= 0)` |
| `identified_fee_amount` | `NUMERIC(15,2)`| `NO` | `0.00` | `CHECK (identified_fee_amount >= 0)` |
| `reported_tax_amount` | `NUMERIC(15,2)`| `NO` | `0.00` | `CHECK (reported_tax_amount >= 0)` |
| `other_deductions_amount`| `NUMERIC(15,2)`| `NO` | `0.00` | `CHECK (other_deductions_amount >= 0)` |
| `allocated_net_amount` | `NUMERIC(15,2)`| `NO` | — | `CHECK (allocated_net_amount >= 0)` |
| `allocation_status` | `TEXT` | `NO` | `'PENDING'` | `CHECK (allocation_status IN ('PENDING', 'VALIDATED', 'POSTED', 'EXCEPTION'))` |
| `exception_reason` | `TEXT` | `YES` | `NULL` | — |
| `provider_payment_id` | `TEXT` | `YES` | `NULL` | — |
| `voucher_id` | `TEXT` | `YES` | `NULL` | `REFERENCES accounting_voucher(id) ON UPDATE CASCADE ON DELETE SET NULL` |
| `metadata` | `JSONB` | `YES` | `'{}'::jsonb` | — |
| `created_at` | `TIMESTAMPTZ` | `NO` | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | `NO` | `NOW()` | — |

**Constraints & Idempotency**:
- `uq_gateway_settlement_batch_txn`: `UNIQUE (payout_batch_id, payment_transaction_id)`

**Indexes**:
- `idx_gateway_settle_batch` on `(payout_batch_id)`
- `idx_gateway_settle_txn` on `(payment_transaction_id)`
- `idx_gateway_settle_order` on `(order_id)`
- `idx_gateway_settle_branch` on `(settlement_branch_id)`
- `idx_gateway_settle_status` on `(allocation_status)`

---

## 9. Constraints, Indexes & Foreign Keys Audit

The independent audit script verified **11 foreign keys** across the newly created tables:
1. `bank_account.branch_id` $\to$ `branch.id`
2. `bank_deposit_slip.branch_id` $\to$ `branch.id`
3. `bank_deposit_slip.bank_account_id` $\to$ `bank_account.id`
4. `bank_deposit_slip.transit_voucher_id` $\to$ `accounting_voucher.id`
5. `bank_deposit_slip.credit_voucher_id` $\to$ `accounting_voucher.id`
6. `gateway_payout_batch.bank_account_id` $\to$ `bank_account.id`
7. `gateway_settlement_order.payout_batch_id` $\to$ `gateway_payout_batch.id`
8. `gateway_settlement_order.payment_transaction_id` $\to$ `payment_transaction.id`
9. `gateway_settlement_order.order_id` $\to$ `"order".id`
10. `gateway_settlement_order.settlement_branch_id` $\to$ `branch.id`
11. `gateway_settlement_order.voucher_id` $\to$ `accounting_voucher.id`

---

## 10. TypeScript Verification

`npx tsc --noEmit` was executed across the frontend application.  
**Result: 0 errors (Exit code 0)**.

Types added to [`frontend/src/lib/types/accounting.types.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts):
- `BankAccountId`, `BankDepositSlipId`, `GatewayPayoutBatchId`, `GatewaySettlementOrderId` (Branded types)
- `BankAccountStatus`, `BankAccountType`, `BankAccountRow`
- `BankDepositStatus`, `BankDepositDenominations`, `BankDepositSlipRow`
- `GatewayPayoutStatus`, `GatewayPayoutBatchRow`
- `GatewayAllocationStatus`, `GatewaySettlementOrderRow`

---

## 11. Security Regression Verification

The standard security regression suite was executed via `node scratch/run_security_regression.js`.  
**Result: 21 PASSED, 0 FAILED (100% PASS RATE)**.

Verified invariants:
- Zero bypass of authentication or authorization.
- BOLA defense intact.
- Server-side branch isolation intact.
- `SUPER_ADMIN` identity controls and SoD intact.
- No exposed credentials or connection leaks.

---

## 12. Post-Migration Database Verification (24/24 Checks Passed)

Independent PostgreSQL audit results:

```text
=============================================================================
CakeToHome ERP — Substep 4.10.1 Post-Migration Comprehensive Independent Audit
=============================================================================

[PASS] [1/24] accounting_account: 99 (expected 99)
[PASS] [2/24] Account 1118 attributes verified (name="Deposit in Transit", parent=1110, level=4, leaf=true, active=true)
[PASS] [3/24] Table bank_account exists and contains exactly 0 rows
[PASS] [4/24] Table bank_deposit_slip exists and contains exactly 0 rows
[PASS] [5/24] Table gateway_payout_batch exists and contains exactly 0 rows
[PASS] [6/24] Table gateway_settlement_order exists and contains exactly 0 rows
[PASS] [7/24] accounting_voucher: 0 (expected 0)
[PASS] [8/24] accounting_journal_entry: 0 (expected 0)
[PASS] [9/24] accounting_journal_line: 0 (expected 0)
[PASS] [10/24] accounting_fiscal_period: 0 (expected 0)
[PASS] [11/24] purchase: 0 (expected 0)
[PASS] [12/24] purchase_item: 0 (expected 0)
[PASS] [13/24] purchase_payment: 0 (expected 0)
[PASS] [14/24] supplier: 0 (expected 0)
[PASS] [15/24] branch: 57 (expected 57)
[PASS] [16/24] branch_inventory: 424 (expected 424)
[PASS] [17/24] inventory_cost_lot: 0 (expected 0)
[PASS] [18/24] inventory_movement: 0 (expected 0)
[PASS] [19/24] inventory_cost_consumption: 0 (expected 0)
[PASS] [20/24] order: 173 (expected 173)
[PASS] [21/24] payment_transaction: 53 (expected 53)
[PASS] [22/24] accounting_start_date: 0 (unconfigured)
[PASS] [23/24] synthetic accounting rows: 0 (expected 0)
[PASS] [24/24] Foreign keys on new tables: 11 verified.

=============================================================================
POST-MIGRATION AUDIT SUMMARY: 24 PASSED, 0 FAILED (TOTAL: 24)
STATUS: 100% PRISTINE & COMPLIANT
=============================================================================
```

---

## 13. Financial Transactions Confirmation

- **Zero** accounting vouchers created (`accounting_voucher: 0`).
- **Zero** journal entries created (`accounting_journal_entry: 0`).
- **Zero** journal lines created (`accounting_journal_line: 0`).
- **Zero** fiscal periods created (`accounting_fiscal_period: 0`).
- **Zero** bank deposits created (`bank_deposit_slip: 0`).
- **Zero** gateway payout batches created (`gateway_payout_batch: 0`).
- **Zero** settlement allocations created (`gateway_settlement_order: 0`).

---

## 14. Historical Data Migration Confirmation

- **Zero** historical orders backfilled or converted to accounting entries (`order: 173` unchanged).
- **Zero** historical payment transactions migrated (`payment_transaction: 53` quarantined as `LEGACY_PROTOTYPE_DATA`).
- Corporate `accounting_start_date` remains unconfigured (`0` rows).

---

## 15. Git State Verification

- **Current HEAD Commit**: `f7d9a47073d64b0da305cc537a6eccb45938fd1b` (Authored Sat Sep 19 20:33:06 2026 by `alexclicks15-lab`).
- **Commits Created in Substep 4.10.1**: **0**.
- **Pushes Executed**: **0**.
- **Working Tree**: Pre-existing uncommitted work preserved.

---

## 16. Files Modified / Created in Substep 4.10.1

1. [`frontend/migrate_phase4f_step4_10_schema.js`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/migrate_phase4f_step4_10_schema.js) — *Created* (Additive DDL & account 1118 migration script).
2. [`frontend/src/lib/types/accounting.types.ts`](file:///E:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/accounting.types.ts) — *Modified* (Appended Step 4.10 domain interfaces and branded types).
3. [`scratch/post_migration_step4_10_1_audit.cjs`](file:///E:/vig/cakes2home-main/cakes2home-main/scratch/post_migration_step4_10_1_audit.cjs) — *Created* (Independent 24-point PostgreSQL audit tool).
4. [`CHECKPOINTS/phase4f-step4-10-substep4-10-1-schema-foundation-01.md`](file:///E:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase4f-step4-10-substep4-10-1-schema-foundation-01.md) — *Created* (Formal completion checkpoint).

---

## 17. Known Limitations

- Substep 4.10.1 is strictly the schema and type foundation.
- No repository methods or service business logic have been created.
- The 4 newly created tables are completely unpopulated (`0` rows).
- Live financial posting for bank deposits and gateway settlements is not yet active.

---

## 18. Next Authorized Boundary

- **Substep 4.10.2**: Bank Account Master Repository & Cash Drawer Deposit Service (`1111` $\to$ `1118` $\to$ `1112`).
- Implementation of Substep 4.10.2 remains **NOT STARTED** and awaits formal review and authorization.

---

## Final Governance Status

```text
PHASE 4F STEP 4.10
SUBSTEP 4.10.1 — SCHEMA FOUNDATION COMPLETE

NEXT:
SUBSTEP 4.10.2 — BANK MASTER & CASH DEPOSIT SERVICE

STATUS:
IMPLEMENTATION STOPPED AT AUTHORIZED BOUNDARY

NO COMMIT
NO PUSH
```
