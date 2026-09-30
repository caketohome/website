# Phase 4F Step 3D.7 Forensic Scope Gate & Architectural Options Report

**Status**: FORENSIC SCOPE GATE — READ-ONLY ANALYSIS — NO CODE MUTATIONS  
**Date**: 2026-09-25  
**Author**: Antigravity  
**Authoritative Recovery Point**: `CHECKPOINTS/phase4f-step3d6b-purchase-reversal-01.md`  
**Git Working Tree**: Clean, 0 staged files, 0 commits, 0 pushes  

---

## 1. Executive Summary & Purpose

Following the verified gate freeze of **Phase 4F Step 3D.6-B (Full Posted Purchase Invoice Reversal / Void)**, the purchase financial and physical accounting lifecycle has achieved complete two-way transactional integrity:

```
[ Purchase Requisition / Order ]
             │
             ├── Submit → Commercial Approval (SoD Dual Custody)
             │
             ├── Step 3D.4: Atomic Purchase Financial & Inventory Posting
             │     └── Dr 1131/1132/1133 Inventory + Dr 114x Input GST / Dr 5240 Freight → Cr 2111 Accounts Payable
             │     └── 1:1 inventory_cost_lot (ACTIVE) + branch_inventory increment + PURCHASE_RECEIPT movement
             │
             ├── Step 3D.5: Supplier Payment Disbursement
             │     └── Dr 2111 Accounts Payable → Cr 1111/1112 Cash/Bank
             │     └── Outstanding balance tracking + leaf account resolution
             │
             ├── Step 3D.6-A: Physical Purchase Return & Supplier Debit Note
             │     └── Dr 2111 Accounts Payable → Cr 1131/1132/1133 Inventory + Cr 114x ITC Reversal
             │     └── Lot quantity decremented (DEPLETED at 0) + branch_inventory decremented + PURCHASE_RETURN movement
             │
             └── Step 3D.6-B: Full Posted Purchase Invoice Reversal / Void
                   └── Dr 2111 Accounts Payable → Cr 1131/1132/1133 Inventory + Cr 114x ITC Reversal + Cr 5240 Freight
                   └── 100% unconsumed lot validation + 0 payments guard + lot REVERSED + INVOICE_REVERSAL movement
                   └── Original voucher remains immutable; bidirectional reversal linkage established
```

Per explicit project directives, **no implementation may begin without user gate authorization**. This document conducts an exhaustive, read-only forensic audit of the existing codebase, live PostgreSQL 17.6 database, and accounting lifecycle, formulating concrete, bounded architectural options for **Phase 4F Step 3D.7** for user review and decision.

---

## 2. Live Database & Regression Baseline Forensic Audit

### 2.1. Authoritative PostgreSQL Baseline Counts
An independent verification of the database confirms that all operational test artifacts from Steps 3D.1 through 3D.6-B rolled back completely:

| Table | Current Count | Status / Baseline |
| :--- | :---: | :--- |
| `public.accounting_account` | **98** | Master Chart of Accounts (24 groups, 74 leaves) |
| `public.accounting_voucher` | **0** | Clean — zero uncommitted/stale vouchers |
| `public.accounting_journal_entry` | **0** | Clean — zero journal entries |
| `public.accounting_journal_line` | **0** | Clean — zero journal lines |
| `public.accounting_fiscal_period` | **0** | Clean — zero synthetic periods (posting fails closed) |
| `public.purchase` | **0** | Clean — zero mock purchases |
| `public.purchase_item` | **0** | Clean — zero mock purchase items |
| `public.purchase_payment` | **0** | Clean — zero mock payments |
| `public.inventory_cost_lot` | **0** | Clean — zero mock cost lots |
| `public.inventory_movement` | **0** | Clean — zero mock movements |
| `public.inventory_cost_consumption` | **0** | Clean — zero cost allocations |
| `public.branch_inventory` | **424** | Physical accessories stock rows (strictly preserved) |
| `public.order` | **173** | Historical customer orders (100% untouched) |
| `public.payment_transaction` | **53** | Historical customer payments (100% untouched) |
| `public.setting` (`accounting_start_date`) | **0** | UNCONFIGURED (posting fails closed) |

### 2.2. Regression Test Suite Health
All upstream test suites remain 100% green across all domains:
- **Phase 4F Step 3D.6-B (Purchase Reversal Suite)**: 101/101 PASS
- **Phase 4F Step 3D.6-A (Purchase Return & Debit Note)**: 121/121 PASS
- **Phase 4F Step 3D.5 (Purchase Payment & AP Settlement)**: 99/99 PASS
- **Phase 4F Step 3D.4 (Atomic GL & Inventory Posting)**: 136/136 PASS
- **Phase 4F Step 3D.3 (Voucher Approval & SoD)**: 82/82 PASS
- **Phase 4F Step 3D.2 (Voucher Construction)**: 67/67 PASS
- **Phase 4F Step 3D.1 (Purchase Tax Engine)**: 58/58 PASS
- **Step 3C.2.2 Independent DB Verification**: 20/20 PASS
- **Security Regression Suite (7 Findings)**: 21/21 PASS
- **TypeScript Compilation (`tsc --noEmit`)**: 0 Errors, 0 Diagnostics

---

## 3. Forensic Analysis: Remaining Gaps in the Purchase & AP Subledger

To determine the legitimate scope for Step 3D.7, we analyzed the boundary conditions, deferred items, and operational requirements remaining in the Purchase & Accounts Payable sub-system.

### Forensic Finding 1: The Asymmetric Reversal Gap (Supplier Payments Cannot Be Voided)
- **Background**:
  - In Step 3D.5, we implemented recording supplier payments: creates a `purchase_payment` row and posts a `PAYMENT` voucher (Dr 2111 AP / Cr 1111 Cash or 1112 Bank).
  - In Step 3D.6-B, we implemented full invoice reversal, with the strict guard: `CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS` (*"Cannot void purchase invoice because supplier payment(s) exist. Supplier payments must be reversed independently before voiding an invoice."*).
- **The Defect / Deadlock Risk**:
  - If a supplier payment was entered in error (e.g. wrong amount, wrong bank account, wrong payment method, duplicate disbursement entry, or bounced check), **there is currently no service method or API to void/reverse that payment**.
  - Because of this, an erroneously paid invoice becomes permanently deadlocked: it cannot receive payment adjustments, nor can it ever be voided under Step 3D.6-B.
- **Accounting Standard for Payment Reversal**:
  - Under GAAP/IFRS and double-entry principles, posted payment vouchers are immutable (`chk_voucher_posted_immutable`).
  - Reversal requires a compensating voucher:
    - **Debit**: `1111` (Cash in Hand) or `1112` (Bank Operating A/c) [Disbursed Funds Restored]
    - **Credit**: `2111` (Accounts Payable) [AP Liability to Supplier Restored]
  - Bidirectional reversal linkage established on `accounting_voucher` and `accounting_journal_entry`.
  - `purchase_payment` record soft-deleted (`deleted_at = NOW()`) or marked reversed.
  - The outstanding payable balance on the purchase invoice is restored, allowing re-payment or invoice voiding.
  - Segregation of Duties: Payer cannot reverse their own disbursement; `ACCOUNTING.POST` permission required.

### Forensic Finding 2: Discrepancy Between Operational Reports & General Ledger
- **Background**:
  - Live repository `purchase.repository.ts` provides reporting functions: `getPurchaseRegister`, `getSupplierWiseSummary`, `getItemWiseSummary`, `getBillWiseSummary`, and `getGstHsnSummary`.
- **The Discrepancy**:
  - In `purchase.repository.ts` (line 589):
    ```sql
    p.total - COALESCE(pp.total_paid, 0) AS balance_due
    ```
  - This calculation computes outstanding balance purely as `total - sum(purchase_payment.amount)`.
  - It **completely ignores**:
    1. **Debit Notes** created during physical purchase returns (Step 3D.6-A). When ₹708 is returned via debit note, `getBillWiseSummary` still reports the full unadjusted balance!
    2. **Voided Purchase Invoices** (Step 3D.6-B). When an invoice is reversed, `getBillWiseSummary` still lists the invoice as active outstanding payable unless filtered out.
- **Subledger / Aging Gap**:
  - CakeToHome lacks an authoritative **Supplier Subledger / Statement of Account** and **AP Aging Schedule** (Current, 1-30, 31-60, 61-90, >90 days overdue).
  - Finance cannot reconcile operational payables against GL Account 2111.

### Forensic Finding 3: The Boundary with Phase 4F Step 4 (Customer Sales, Revenue & COGS Accounting)
- **Background**:
  - Step 3D was dedicated to **Inbound Purchase Accounting & Inventory Costing**:
    - Item costing, tax calculation, voucher construction, approval, posting, payments, returns, and invoice voids.
  - The next major phase in CakeToHome ERP accounting is **Phase 4F Step 4**: **Outbound Customer Sales, Order Delivery, Revenue Recognition & COGS Fulfillment**.
- **The Architectural Question**:
  - Should Step 3D.7 complete the remaining AP subledger edges (Payment Reversal + AP Subledger / Aging) to achieve 100% closure of the Purchase module?
  - OR should Step 3D conclude now with Step 3D.6, and the project transition directly to Phase 4F Step 4 (Sales & COGS)?

---

## 4. Scope Gate Options for Phase 4F Step 3D.7

Based on the forensic findings, three viable, well-bounded architectural options are presented:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       PHASE 4F STEP 3D.7 OPTIONS                                        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ OPTION A: Supplier Payment Reversal / Void & Check Bounce Workflow                                    │
│   • Close the asymmetric payment deadlock identified in Step 3D.6-B.                                  │
│   • Reverses posted supplier payments (Dr Cash/Bank, Cr 2111 AP).                                     │
│   • Restores invoice balance, enabling subsequent re-payment or invoice voiding.                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ OPTION B: AP Subledger, Aging & Report Reconciliation Suite                                            │
│   • Align purchase operational reports with Debit Notes (3D.6-A) and Reversals (3D.6-B).              │
│   • Implement Supplier Statement of Account (chronological GL subledger for Account 2111).             │
│   • Implement AP Aging Schedule (Current, 1-30, 31-60, 61-90, 90+ days overdue).                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ OPTION C: Complete Accounts Payable Closure Suite (Option A + Option B Sequenced)                      │
│   • Sub-step 3D.7-A: Supplier Payment Reversal / Void                                                  │
│   • Sub-step 3D.7-B: AP Subledger, Aging & Report Reconciliation                                       │
│   • 100% closes all operational and reporting cycles in Purchase & AP before opening Step 4.           │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ OPTION D: Conclude Step 3D & Transition Directly to Phase 4F Step 4 (Sales, Revenue & COGS)           │
│   • Declare Step 3D complete with Step 3D.6-B.                                                        │
│   • Proceed directly to Step 4: Customer Order Revenue, Output GST & FIFO Cost-Lot COGS.             │
│   • Defer payment reversals and AP aging to post-revenue phases.                                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Detailed Comparative Analysis of Options

| Dimension | Option A: Payment Reversal | Option B: AP Subledger & Aging | Option C: Complete AP Closure (A + B) | Option D: Skip to Step 4 (Sales/COGS) |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Scope** | Voiding supplier disbursements; restoring AP liability | Vendor Statement, AP Aging, Report Alignment | Both Transactional Void and Reporting Alignment | Customer Sales Recognition & COGS Fulfillment |
| **Solves Payment Deadlock?** | **YES** — Unlocks invoices blocked by erroneous payments | NO — Deadlock remains | **YES** — Complete resolution | NO — Deadlock remains |
| **Reconciles GL 2111 to Reports?** | NO — Operational reports remain unaligned with debit notes | **YES** — Full alignment | **YES** — Full alignment | NO — Deferred |
| **Pre-requisite for Sales/COGS?** | No, but prevents technical debt in AP | No, but ensures reporting integrity | No, but cleanest separation of concerns | Enables immediate progress on outbound inventory |
| **Accounting Risk** | **Low** — Reuses existing canonical `PostingService` reversal primitives | **Zero** — Read-only query aggregations | **Low** — Two clean, independently gated sub-steps | **Medium** — Leaves incomplete transactional workflows behind |
| **Test Surface Estimate** | ~60–80 tests (Status, SoD, Balance Restoration, Idempotency) | ~40–50 tests (Aging math, statement reconciliation, filters) | ~110–130 tests across two gated milestones | ~150+ tests (Tax engine, FIFO lot allocation, COGS) |
| **Implementation Complexity** | Medium (1 new service method, 1 repository method) | Low-to-Medium (Repository report queries, DTOs) | Medium (Sequenced A then B) | High (New domain: Orders, Gateway, Output GST, FIFO) |

---

## 6. Detailed Architectural Specification for Recommended Option

### Recommendation: **Option C (Complete Accounts Payable Closure Suite)** or **Option A (Payment Reversal Only)**

If the priority is strict GAAP/ERP completeness, **Option A** is the most urgent transactional necessity, because **3D.6-B explicitly created a dependency on it** (`CANNOT_REVERSE_PURCHASE_WITH_PAYMENTS` requires payment reversal capability).

### Specification of Option A (Supplier Payment Reversal / Void):
1. **Target**: `PurchasePaymentService.reversePayment({ paymentId, purchaseId, branchId, reason, reversalDate, reversedBy, client })`.
2. **Pre-conditions & Guards**:
   - Payment must exist and not be already deleted/reversed (`deleted_at IS NULL`).
   - Purchase must be in `POSTED` status.
   - Associated `PAYMENT` voucher must be `POSTED` and not already reversed (`reversed_by_voucher_id IS NULL`).
   - Branch isolation / BOLA check enforced.
   - Fail-closed configuration check (accounting start date, fiscal period).
   - Segregation of Duties: Payer (`created_by` of payment) cannot reverse; commercial approver cannot reverse; supervisor with `ACCOUNTING.POST` required; `SUPER_ADMIN` cannot bypass SoD.
3. **Double-Entry Compensating Voucher**:
   - **Debit**: `1111` (Cash in Hand) or `1112` (Bank Operating A/c) [Disbursed Funds Restored]
   - **Credit**: `2111` (Accounts Payable) [AP Liability to Supplier Restored]
   - Preserves `supplier_id` and `branch_id` dimensions.
4. **Lifecycle & Linkage**:
   - Reversal voucher created as type `JOURNAL` (or `PAYMENT_REVERSAL`), ref `PURCHASE_PAYMENT_REVERSAL`, event `PAYMENT_REVERSAL`.
   - Linked via `reversal_of_voucher_id` and `reversed_by_voucher_id`.
   - Original journal entry marked `is_reversed = true`, `reversed_at = NOW()`.
   - Soft-delete payment row (`deleted_at = NOW()`, metadata annotated with `reversal: { reversed_at, reversed_by, reversal_voucher_id, reason }`).
   - Outstanding balance on purchase invoice automatically restored:
     $$\text{outstanding\_balance} = \text{purchase.total} - \sum(\text{active payments}) - \sum(\text{debit notes})$$
5. **Idempotency**: Second reversal attempt fails closed with `PAYMENT_ALREADY_REVERSED`.
6. **Savepoint Isolation**: Full failure injection verifies complete rollback on error.

---

## 7. Mandatory Gate Declaration & Stop

> [!IMPORTANT]
> **PHASE 4F STEP 3D.7 FORENSIC SCOPE GATE COMPLETE**
> - **READ-ONLY AUDIT**: 100% Complete. Zero files or schema modified.
> - **AUTHORITATIVE RECOVERY POINT**: Intact at `CHECKPOINTS/phase4f-step3d6b-purchase-reversal-01.md`.
> - **POSTGRESQL BASELINE**: Verified pristine (98 accounts, 0 vouchers, 0 journals, 424 inventory, 173 orders, 53 payments).
> - **GIT INTEGRITY**: Clean working tree, 0 commits, 0 pushes.
> 
> **EXECUTION REMAINS STOPPED AT THIS GATE.**
> Awaiting user review of the forensic report and selection of the authorized milestone (Option A, Option B, Option C, or Option D).
