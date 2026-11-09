# CAKETOHOME ERP — PHASE C7.5 CHECKPOINT REPORT
## Branch Cash Control, Vault/Safe Custody & Petty Cash Imprest

**Status**: 🔒 **PHASE C7.5 FROZEN & ACCEPTED — STRICT STOP PROTOCOL ENFORCED**  
**Timestamp**: 2026-10-08  
**Corpus / Workspace**: `E:\vig\cakes2home-main\cakes2home-main\frontend`  
**Prior Milestones**: Phase C7.4, C7.3, C7.2, C7.1, C6.1, C5, C4.2, C4.1 (ALL FROZEN & VERIFIED)  
**Next Milestone**: Phase C7.6 — Cost Centre Accounting & Allocation Engine (Awaiting User Authorization)

---

### 1. Executive Summary & Recovery Context

This checkpoint establishes the final frozen verification of **Phase C7.5: Branch Cash Control, Vault/Safe Custody & Petty Cash**.
Following an IDE crash during the remediation phase, forensic inspection, test database sanitization, strict TypeScript alignment, and GST tax architecture audits were executed without altering frozen architecture or predecessor semantics.

Key deliverables verified:
1. **Immutable Vault Custody Ledger** (`public.branch_vault_movement`): mathematically derived safe custody without mutable balance columns, guarded by PostgreSQL immutability trigger `trg_branch_vault_movement_immutability`.
2. **Atomic Mid-Day Safe Drop** (`Till -> Vault`): canonical correlation IDs (`safe_drop_id`), atomic idempotency (`uq_branch_vault_movement_source`), distinct authenticated witness verification (Actor $\ne$ Witness), and zero general ledger impact.
3. **Vault Float Replenishment** (`Vault -> Till`): restoring teller drawers safely from physical vault cash with duplicate protection and balance checks.
4. **True Imprest Petty Cash Lifecycle** (`public.petty_cash_request`): 3-tier Segregation of Duties (Branch Manager Maker $\ne$ Central Finance Checker $\ne$ Central Accounts Disburser), dynamic Input GST resolution (`1141`-`1149`) from the database, and zero duplicate P&L expense recognition upon central reimbursement.
5. **Fail-Closed Relative Drawer Thresholds**: 100% warning badge and hard 140% server-side cash-tender block (`assertCashTenderAllowed`) while permitting non-cash payment instruments (Card/UPI/online).
6. **Fail-Safe Reconciliation Engine**: surfacing variances between GL `1111` and Physical Cash (Drawer + Vault) as operational audit alerts without automated plugs or fictitious entries to GL `5296`.
7. **Strict Cross-Branch & Intersite Policy**: Inter-branch physical cash transfers are strictly prohibited. Surplus cash routes `Till -> Safe -> Bank Deposit (1118) -> Bank (1112)`.

---

### 2. Forensic Remediation Summary

#### 2.1 Blocker #1: Test DB Contamination Cleaned & C4.1 Baseline Restored
- **Root Cause**: Exploratory scratch testing on 2026-10-07 left 5 orphan `PETTY_CASH` vouchers and 1 empty journal entry without lines or parent request links.
- **Remediation**: Safely audited and pruned the orphan exploratory test records without truncating legitimate tables or modifying frozen application logic.
- **Result**: Unchanged frozen C4.1 test file [`test_phase_c4_1_api_settlement.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_phase_c4_1_api_settlement.js) was executed:
  - **99 / 99 ASSERTIONS PASSED (100% Green)**.

#### 2.2 Blocker #2: TypeScript Alignment (14 Errors Resolved)
- **Root Cause**:
  1. [`route.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/%5B...path%5D/route.ts): `branch_id` vs `branchId` naming, pagination limit/offset contract, and `BranchCashReconciliationDetail` field name mismatches (`active_drawer_cash`, `vault_cash`, `warning_threshold`, `critical_threshold`, `drawer_threshold_status`).
  2. [`route.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/%5B...path%5D/route.ts): `AuthenticatedActor` typed as `{ id: string }` instead of `{ userId: string, ... }`.
  3. [`petty-cash.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/petty-cash.service.ts): `VoucherCreateInput` missing mandatory `branch_id` at draft creation calls (lines 333, 562, 694).
  4. [`vault-custody.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/vault-custody.service.ts): Actor type contract alignment.
- **Remediation**:
  - Implemented concrete, strict actor interfaces (`VaultActor`, `PettyCashActor`) matching `AuthenticatedActor` without open index signatures.
  - Linked `branch_id: request.branch_id` into all `createVoucherDraft` inputs.
  - Aligned all reconciliation property names in route handlers.
  - **Zero use of `any`, `@ts-ignore`, or `@ts-expect-error`**.
- **Result**:
  - `npx tsc --noEmit` exited with code 0 (**0 errors, 0 warnings**).

#### 2.3 Blocker #3: GST / Tax Forensic Architecture Audit
- **Findings**:
  - Investigated `purchase-tax-engine.ts`, `sales-tax-engine.ts`, and `expense-posting.service.ts`.
  - Sales tax engine is dedicated to output taxes on sales orders.
  - Purchase tax engine provides canonical rounding utilities (`round2`).
  - Petty Cash Input GST is governed by the Chart of Accounts `accounting_account` under `subtype = 'INPUT_TAX'` and rate configuration.
- **Remediation & Architecture Enforcement**:
  - Upgraded `PettyCashService.recordExpenseClaim` and `postExpenseClaimVoucher` with dynamic PostgreSQL account resolution (`resolveInputTaxAccountCode`).
  - Account codes (`1141`-`1149`) are queried dynamically matching `subtype = 'INPUT_TAX'` and `tax_rate = (taxRatePct / 2)` (for CGST/SGST split) or full rate (for IGST).
  - Server retains 100% calculation authority (derives net expense and GST amounts server-side; client cannot dictate accounting debits/credits).
  - Canonical `round2` from `purchase-tax-engine.ts` is reused. Zero duplicate rounding engines.
  - Zero hardcoded GST rates.

---

### 3. Core Invariants & Architectural Rules

| Invariant | Specification Rule | Implementation Proof | Status |
| :--- | :--- | :--- | :---: |
| **Strict CoA Freeze** | Zero new GL accounts; CoA locked at exactly 100 accounts | Verified: `SELECT COUNT(*) FROM accounting_account` = 100. Accounts: `1111`, `1112`, `1114`, `1118`, `5296`, `5299`, `1141`-`1149`. | 🔒 LOCKED |
| **Pure Derived Custody** | Zero mutable scalar balance columns on `public.branch` | Direct DB audit verifies `branch` has NO `vault_balance`, NO `safe_cash_balance`, and NO `cash_balance`. Vault custody is 100% derived from `branch_vault_movement`. | 🔒 VERIFIED |
| **Atomic Safe Drop Idempotency** | Duplicate submissions must return existing transaction without double-decrementing cash | Partial unique index `uq_branch_vault_movement_source` on `(source_type, source_id)`. Re-submitting the same `safe_drop_id` returns `was_duplicate: true` with identical custody state. | 🔒 VERIFIED |
| **Authenticated Witness Verification** | Safe Drop requires distinct staff witness; Actor $\ne$ Witness | Enforced in `VaultCustodyService` and UI. Self-witnessing rejects with `WITNESS_SELF_VALIDATION`. Missing witness rejects with `WITNESS_NOT_FOUND`. | 🔒 VERIFIED |
| **True Imprest Petty Cash Accounting** | Initial: Dr 1114 / Cr 1112<br>Expense: Dr 5299 + Dr 1141-1149 / Cr 1114<br>Reimbursement: Dr 1114 / Cr 1112 | Implemented in `PettyCashService`. Automated tests verify double entries, dynamic GST splitting, and zero duplicate P&L expense on reimbursement. | 🔒 VERIFIED |
| **3-Tier Segregation of Duties** | Maker $\ne$ Checker $\ne$ Disburser for petty cash | Database check constraints `chk_petty_cash_sod_maker_checker` and `chk_petty_cash_sod_maker_disburser` active in PostgreSQL and service layer. | 🔒 VERIFIED |
| **Relative Drawer Thresholds** | 100% Warning, 140% Critical Cash-Tender Block | Derived from `branch.metadata->>'max_drawer_cash_limit'`. At $\ge 140\%$, `assertCashTenderAllowed` throws `CASH_TENDER_BLOCKED` on cash receipts while non-cash orders proceed. | 🔒 VERIFIED |
| **Fail-Closed Policy** | Unconfigured branch blocks cash transactions | Missing branch metadata throws fail-closed configuration error rather than assuming unlimited capacity. | 🔒 VERIFIED |
| **Fail-Safe Reconciliation** | Variances must not be automatically plugged | Reconciliation sets `reconciliation_status = VARIANCE_DETECTED` and `requires_audit = true`. Zero entries posted to `5296 Cash Over/Short`. | 🔒 VERIFIED |
| **Inter-Branch Cash Prohibition** | Zero branch-to-branch cash movement | No inter-branch cash transit workflows exist. Excess branch cash follows `Till -> Safe -> Bank Deposit (1118) -> Bank (1112)`. | 🔒 PROHIBITED |

---

### 4. Database Schema Deliverables

1. **`public.branch_vault_movement`**:
   - Primary custody ledger for branch safe deposits and withdrawals.
   - Fields: `id`, `branch_id`, `direction` (`IN` / `OUT`), `movement_type` (`SAFE_DROP`, `FLOAT_REPLENISHMENT`, `BANK_DEPOSIT_DISPATCH`, `INITIAL_FUNDING`, `ADJUSTMENT`), `amount`, `source_type`, `source_id`, `teller_session_id`, `witness_user_id`, `created_by`, `narration`, `created_at`.
   - Immutability Trigger: `trg_branch_vault_movement_immutability` unconditionally raises an exception on `UPDATE` or `DELETE`.
   - Unique Index: `uq_branch_vault_movement_source` on `(source_type, source_id)` for atomic idempotency.

2. **`public.petty_cash_request`**:
   - Imprest lifecycle entity tracking requests, claims, and disbursements.
   - Fields: `id`, `branch_id`, `request_number`, `request_type` (`INITIAL_FUNDING`, `EXPENSE_CLAIM`, `REIMBURSEMENT`), `amount`, `status` (`SUBMITTED`, `APPROVED`, `DISBURSED`, `REJECTED`), `purpose`, `tax_rate`, `tax_amount`, `net_amount`, `receipt_reference`, `maker_user_id`, `checker_user_id`, `disburser_user_id`, `payment_voucher_id`, `journal_entry_id`, timestamps.
   - SoD Check Constraints: `chk_petty_cash_sod_maker_checker` and `chk_petty_cash_sod_maker_disburser`.

3. **`public.teller_movement`**:
   - Check constraint `chk_teller_movement_type` updated to support `'SAFE_DROP'` and `'SAFE_TO_TILL'`.

4. **`public.branch.metadata`**:
   - Configured fail-closed thresholds across all 53 active operating branches:
     - Standard outlets: `max_drawer_cash_limit = 25000`, `petty_cash_imprest_limit = 5000`
     - Central / Flagship hubs: `max_drawer_cash_limit = 50000`, `petty_cash_imprest_limit = 15000`

---

### 5. Code & Architecture Deliverables

#### 5.1 Domain Models & Types
- [`vault-custody.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/vault-custody.types.ts): Data contracts for vault movements, safe drops, petty cash claims, reconciliation details, and threshold status.
- [`teller.types.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/types/teller.types.ts): Added `SAFE_DROP` and `SAFE_TO_TILL` to teller movement type enums.

#### 5.2 Repositories & Services
- [`vault-custody.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/vault-custody.repository.ts): Query builder for immutable vault movements and mathematical custody derivation.
- [`petty-cash.repository.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/repositories/petty-cash.repository.ts): Data access layer for petty cash requests and claims.
- [`vault-custody.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/vault-custody.service.ts): Core domain service executing atomic safe drops, till float replenishment, and deposit dispatches with SoD and idempotency.
- [`petty-cash.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/petty-cash.service.ts): Implements true imprest accounting with `executeInTransaction` helper, dynamic GST resolution, and voucher integration.
- [`branch-cash.service.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/branch-cash.service.ts): Consolidated branch cash position engine, derived vault custody, relative threshold calculations, fail-safe reconciliation, and `assertCashTenderAllowed`.
- [`staff-access-control.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/staff-access-control.ts): Registered RBAC permissions for vault custody, safe drops, and petty cash operations.

#### 5.3 API Endpoints Mounted & Verified
- `POST /api/v1/admin/teller/safe-drop`: Mid-day safe drop from till to vault.
- `POST /api/v1/admin/teller/safe-to-till`: Float replenishment from vault to till.
- `GET /api/v1/admin/teller/cash-tender-status`: Real-time query checking if cash tender is permitted for a branch.
- `GET /api/v1/admin/accounting/branch-cash-position`: Company-wide consolidated summary with 5 KPI metrics.
- `GET /api/v1/admin/accounting/branch-cash-position/:branchId`: Deep reconciliation drilldown for a single branch.
- `GET /api/v1/admin/accounting/petty-cash`: List petty cash requests with branch filtering.
- `POST /api/v1/admin/accounting/petty-cash/request-funding`: Submit initial float request.
- `POST /api/v1/admin/accounting/petty-cash/expense-claim`: Submit expense claim with dynamic GST rate.
- `POST /api/v1/admin/accounting/petty-cash/:id/approve`: Central finance checker approval.
- `POST /api/v1/admin/accounting/petty-cash/:id/disburse`: Float disbursement posting Dr 1114 / Cr 1112.
- `POST /api/v1/admin/accounting/petty-cash/:id/reimburse`: Imprest reimbursement posting Dr 1114 / Cr 1112.

#### 5.4 User Interface Deliverables
- [`BranchCashTab.tsx`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/components/dashboard/admin/teller/BranchCashTab.tsx):
  - **5 Top KPI Cards**: GL Cash in Hand (1111), Branch Petty Cash (1114), Active Drawer Custody, Branch Vault Custody (Derived), and Total Physical Cash.
  - **Authoritative Master Table**: Displays branch limits, drawer custody, vault custody, total physical cash, threshold badge (`NORMAL`, `WARNING`, `CRITICAL • CASH BLOCKED`), and reconciliation badge (`Reconciled` / `Variance Detected`).
  - **Mid-Day Safe Drop Modal**: Form with live drawer and vault cash preview, required authenticated witness staff selection, and atomic submission.
  - **Till Float Replenishment Modal**: Replenish drawer from safe vault.
  - **Petty Cash Imprest Management Modal**: Three-tab workflow (`Requests & Claims`, `+ Request Initial Float`, `+ Record Expense Claim` with dynamic GST rate selector).
  - **Detailed Reconciliation Drilldown Modal**: Deep dive comparing GL 1111 with Physical Cash, highlighting audit alerts without automated plugs.

---

### 6. Comprehensive Verification Evidence

#### 6.1 Automated Backend Suite (`scratch/test_phase_c7_5_branch_cash.js`)
- **Total Assertions**: **60 PASSED / 0 FAILED** (100% Green)
- Key verifications:
  - Immutability trigger strictly prevents UPDATE and DELETE on `branch_vault_movement`.
  - Self-witnessing blocked (`WITNESS_SELF_VALIDATION`).
  - Safe drop exceeding drawer cash blocked (`INSUFFICIENT_DRAWER_CASH`).
  - Safe drop idempotency verified: retry returns `was_duplicate: true` with zero duplicate inserts.
  - Safe drop has zero GL impact; Trial Balance unchanged.
  - Replenishment exceeding vault blocked (`INSUFFICIENT_VAULT_CASH`).
  - Petty Cash 3-tier SoD: Maker cannot approve, Maker cannot disburse, Checker cannot disburse.
  - Initial funding accounting: Dr 1114 / Cr 1112.
  - Expense claim accounting: Dr 5299 / Dr 1141-1142 / Cr 1114.
  - Reimbursement accounting: Dr 1114 / Cr 1112 with zero duplicate P&L expense recognition.
  - Relative threshold logic: 100% warning, 140% critical cash-tender block (`assertCashTenderAllowed`).
  - Fail-safe reconciliation: variance detected, `requires_audit = true`, zero entries posted to `5296`.
  - BOLA protection: cross-branch access strictly prevented.

#### 6.2 Real Chromium Browser Verification via Playwright (`scratch/verify_c7_5_browser.js`)
- **Total Assertions**: **31 PASSED / 0 FAILED** (100% Green)
- Executed against live running Next.js dev server on `http://localhost:3000`:
  - Flow 1: 5 KPI Summary Cards verified.
  - Flow 2: Branch Cash Master Table and action buttons verified.
  - Flow 3: Mid-Day Safe Drop Modal opened, authenticated witness field validated, modal closed cleanly.
  - Flow 4: Till Float Replenishment Modal opened and validated.
  - Flow 5: Petty Cash Imprest Modal opened, dynamic GST dropdown verified, closed cleanly.
  - Flow 6: Deep Cash Reconciliation Drilldown Modal opened, GL vs physical balances displayed.
- **Screenshots Captured**:
  1. `c7_5_branch_cash_overview.png`
  2. `c7_5_safe_drop_modal.png`
  3. `c7_5_replenish_till_modal.png`
  4. `c7_5_petty_cash_modal.png`
  5. `c7_5_reconciliation_modal.png`

#### 6.3 Independent Direct PostgreSQL Audit (`scratch/audit_phase_c7_5_db.js`)
- **Total Assertions**: **25 PASSED / 0 FAILED** (100% Green)
- Audit items verified directly against database:
  - CoA account count is exactly 100 accounts (0 new GL accounts created).
  - Trial Balance balances: Total Dr ₹3,380.00 = Total Cr ₹3,380.00 (diff = ₹0.0000).
  - Zero entries posted to `5296 Cash Over/Short`.
  - Zero mutable balance columns on `public.branch`.
  - Immutability trigger `trg_branch_vault_movement_immutability` registered and active.
  - Unique index `uq_branch_vault_movement_source` active on `(source_type, source_id)`.
  - SoD check constraints active on `public.petty_cash_request`.
  - Movement types `SAFE_DROP` and `SAFE_TO_TILL` supported in `teller_movement`.
  - 53 of 53 active branches have configured fail-closed limits. Zero unconfigured branches.

#### 6.4 Full Predecessor Regression Matrix (Frozen & Protected)
- **Phase C7.4 (Bills Receivable)**: **62 / 62 PASSED** ✅
- **Phase C7.3 (Payment & Teller)**: **55 / 55 PASSED** ✅
- **Phase C7.2 (Bills Payable Comprehensive)**: **32 / 32 PASSED** ✅
- **Phase C6.1 (Manual Journal Persistence)**: **51 / 51 PASSED** ✅
- **Phase C5 (Expense Accounting)**: **40 / 40 PASSED** ✅
- **Phase C4.1 (API Settlement — Frozen Suite)**: **99 / 99 PASSED** ✅

---

### 7. Baseline Integrity Confirmation

- **TypeScript Compiler (`tsc --noEmit`)**: 0 errors (Exit code 0).
- **Chart of Accounts**: Exactly 100 accounts (Zero new GL accounts created).
- **Trial Balance**: Dr ₹3,380.00 = Cr ₹3,380.00 (Perfect balance, zero plugs).
- **Orphan Vouchers & Journal Entries**: Exactly 0 orphan vouchers, 0 empty entries.
- **Strict Stop Protocol**: Zero git commits or git pushes executed.
- **Phase Boundary**: No downstream C7.6–C7.8 features implemented. Phase C7.5 is fully complete, frozen, and awaiting user instructions.
