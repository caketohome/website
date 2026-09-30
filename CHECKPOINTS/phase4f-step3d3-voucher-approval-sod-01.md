# Phase 4F Step 3D.3 Checkpoint — Voucher Accounting Approval & Segregation of Duties (SoD)

**Status**: PASS / VERIFIED / CHECKPOINTED  
**Date**: 2026-09-24  
**Author**: Antigravity  
**Commit/Push**: NONE (Zero git mutations)

---

## 1. Executive Summary

Phase 4F Step 3D.3 establishes the canonical authorization and Segregation of Duties (SoD) boundary for purchase accounting vouchers:

```
Voucher DRAFT (AP Clerk / Preparer)
      ↓
SUBMITTED (AP Submitter)
      ↓
Canonical Accounting Permission Check (hasEffectivePermission via StaffAccessControl)
      ↓
Multi-Identity Segregation of Duties (SoD) Validation
      ↓
APPROVED (Accounting Supervisor)
      ↓
STOP (Zero Financial or Physical Posting)
```

In accordance with strict gate boundaries:
- **Scope strictly limited**: Only authorization and lifecycle transition to `APPROVED` / `CANCELLED`.
- **Zero financial posting**: `accounting_journal_entry` = 0, `accounting_journal_line` = 0.
- **Zero inventory mutation**: `inventory_cost_lot` = 0, `inventory_movement` = 0, `branch_inventory` remains untouched at **424**.
- **Commercial purchase status preserved**: `purchase.status` remains `APPROVED` (not POSTED).
- **Zero AP settlements**: `purchase_payment` = 0, cash/bank accounts untouched.
- **Fail-closed configurations preserved**: `fiscal_period` = 0, `accounting_start_date` remains **UNCONFIGURED**.
- **Rollback-guarded test suite**: All 82 tests executed within an isolated rollback transaction, leaving the database completely clean post-rollback.

---

## 2. Segregation of Duties & Permission Architecture

### 2.1 The 5 Distinct Audit Identities

The lifecycle preserves five distinct, auditable identities across the operational and financial boundary:

| Role in Lifecycle | Column / Field | Responsibilities & Boundaries |
| :--- | :--- | :--- |
| **Buyer / Order Creator** | `purchase.created_by` | Creates the commercial purchase requisition/order. Cannot approve purchase; cannot approve voucher. |
| **Store Manager** | `purchase.approved_by` | Approves commercial receipt and goods inspection. Cannot approve accounting voucher (dual-control SoD). |
| **AP Clerk (Preparer)** | `voucher.created_by` | Prepares draft accounting voucher and validates supplier invoice against purchase. Cannot approve own voucher. |
| **AP Submitter** | `voucher.submitted_by` | Reviews and submits draft voucher to accounting queue. Cannot approve voucher. |
| **Accounting Supervisor** | `voucher.approved_by` | Authorizes financial recognition. Must possess `ACCOUNTING.APPROVE` via canonical resolver. Distinct from all 4 prior identities. |

### 2.2 Canonical Permission Resolution (`hasEffectivePermission`)

Authorization is verified via `hasEffectivePermission(actorContext, "ACCOUNTING.APPROVE")`:
- **No arbitrary role string trust**: Passing arbitrary role strings (e.g. `role: 'ACCOUNTANT'`) without canonical profile assignments fails closed.
- **System access profile integration**: Checks active assigned access profiles in `StaffAccessControlStore`.
- **Precedence hierarchy enforced**:
  1. `SUPER_ADMIN` (unrestricted permission resolution, but still subject to SoD self-approval restrictions)
  2. Explicit Staff-Level `DENY` override (highest precedence for standard staff, fails closed)
  3. Explicit Staff-Level `ALLOW` override
  4. Profile-Level Permission Union (Active profiles)
  5. Default: Fail Closed (`false`)

### 2.3 Strict Segregation of Duties Rules

1. **Voucher Creator Self-Approval Rejected**:
   `approvedBy === voucher.created_by` $\longrightarrow$ `SEGREGATION_OF_DUTIES_VIOLATION`
2. **Voucher Submitter Self-Approval Rejected**:
   `approvedBy === voucher.submitted_by` $\longrightarrow$ `SEGREGATION_OF_DUTIES_VIOLATION`
3. **Commercial Buyer Voucher Approval Rejected**:
   `approvedBy === purchase.created_by` $\longrightarrow$ `SEGREGATION_OF_DUTIES_VIOLATION`
4. **Commercial Store Manager Dual-Control Rejection**:
   `approvedBy === purchase.approved_by` $\longrightarrow$ `SEGREGATION_OF_DUTIES_VIOLATION`
5. **Super Admin SoD Enforcement**:
   Even `SUPER_ADMIN` (`admin_01`) cannot approve vouchers they prepared as creator. DB constraint `chk_voucher_segregation` and application guards both enforce this invariant.

### 2.4 State Machine & Rejection Behavior

- **Lifecycle progression**: `DRAFT` $\longrightarrow$ `SUBMITTED` $\longrightarrow$ `APPROVED`.
  - Attempting to approve a `DRAFT` voucher fails: `INVALID_VOUCHER_STATE`.
  - Attempting to re-approve an `APPROVED` voucher fails: `INVALID_VOUCHER_STATE`.
  - Attempting to approve a `CANCELLED` voucher fails: `INVALID_VOUCHER_STATE`.
  - Attempting to approve a voucher linked to non-`APPROVED` purchase fails: `INVALID_PURCHASE_STATUS`.
- **Rejection / Cancellation**:
  - `SUBMITTED` $\longrightarrow$ `CANCELLED`.
  - Requires mandatory, non-empty `rejectionReason`.
  - Authorized accounting supervisor permission required (`ACCOUNTING.APPROVE`).
  - Records `cancelled_by`, `cancelled_at`, and audit metadata on the voucher row.

---

## 3. Verification & Test Evidence

### 3.1 Step 3D.3 Test Suite (`scratch/test_step3d3_voucher_approval.js`)
- **82/82 PASS (100%)**
- Test Group 1: Canonical Permission Resolution via `hasEffectivePermission` (5/5 PASS)
- Test Group 2: Full Valid Lifecycle & 5 Distinct Audit Identities (20/20 PASS)
- Test Group 3: Segregation of Duties Violations (Creator, Submitter, Buyer, Store Manager, Super Admin) (15/15 PASS)
- Test Group 4: Permission-Resolver-Based Authorization (10/10 PASS)
- Test Group 5: Voucher Lifecycle & State Machine Constraints (10/10 PASS)
- Test Group 6: Branch Authorization Boundaries (BOLA / IDOR Defense) (5/5 PASS)
- Test Group 7: Rejection & Cancellation Workflow (10/10 PASS)
- Test Group 8: Database Integrity & Post-Rollback Zero Persistence (7/7 PASS)

### 3.2 Regression Suites
- **Step 3D.2 Voucher Construction Suite**: **67/67 PASS**
- **Step 3D.1 Purchase Tax Engine Suite**: **58/58 PASS**
- **Independent PostgreSQL Baseline Check**: **20/20 PASS**
- **Security Regression Suite (`scripts/run-security-regression-tests.ps1`)**: **21/21 PASS**
- **TypeScript Static Verification (`tsc --project tsconfig.json --noEmit`)**: **0 Diagnostics / 0 Errors**

### 3.3 Live PostgreSQL State Verification
| Entity / Invariant | Expected Baseline | Live State Post-Rollback | Verification Result |
| :--- | :--- | :--- | :--- |
| `accounting_account` | 98 | 98 | PASS |
| `accounting_voucher` | 0 | 0 | PASS |
| `accounting_journal_entry` | 0 | 0 | PASS |
| `accounting_journal_line` | 0 | 0 | PASS |
| `accounting_fiscal_period` | 0 | 0 | PASS |
| `purchase` | 0 | 0 | PASS |
| `purchase_item` | 0 | 0 | PASS |
| `purchase_payment` | 0 | 0 | PASS |
| `branch_inventory` | 424 | 424 | PASS |
| `inventory_cost_lot` | 0 | 0 | PASS |
| `inventory_movement` | 0 | 0 | PASS |
| `inventory_cost_consumption` | 0 | 0 | PASS |
| `packaging products` | 0 | 0 | PASS |
| `orders` | 173 | 173 | PASS |
| `payment_transactions` | 53 | 53 | PASS |
| `accounting_start_date` | UNCONFIGURED | UNCONFIGURED | PASS |
| `git commits / pushes` | 0 | 0 | PASS |

---

## 4. Next Step Boundary: Step 3D.4 Atomic Financial & Physical Posting

The boundary has been strictly maintained: vouchers stop at `APPROVED`.

Step 3D.4 (deferred to subsequent gate approval) will implement the final atomic posting transition:
```
Voucher APPROVED
      ↓
Begin PostgreSQL Transaction
      ├── Lock voucher (APPROVED), purchase (APPROVED), items
      ├── Post GL: write accounting_journal_entry + accounting_journal_lines (balanced)
      ├── Post Cost Ledger: create inventory_cost_lot (item_type, unit_cost, quantity)
      ├── Post Physical Ledger: create inventory_movement (PURCHASE_RECEIPT, direction IN)
      ├── Update branch_inventory (catalog items only: increment quantity)
      ├── Transition voucher: APPROVED → POSTED (record posted_by, posted_at, total_amount)
      └── Transition purchase: APPROVED → POSTED (record posted_at)
Commit Transaction
```
