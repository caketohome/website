# Phase 4F Step 3D.2 Checkpoint — Purchase Accounting Voucher Construction

**Status**: PASS / VERIFIED / CHECKPOINTED  
**Date**: 2026-09-24  
**Author**: Antigravity  
**Commit/Push**: NONE (Zero git mutations)

---

## 1. Executive Summary

Phase 4F Step 3D.2 establishes the canonical bridge between the **frozen Purchase Tax & Total Engine (Step 3D.1)** and the **Double-Entry General Ledger Voucher Lifecycle**:

```
Purchase Tax Engine (Frozen 3D.1)
        ↓
Validated Purchase Totals (Exact Penny Reconciled)
        ↓
Voucher DRAFT (Canonical PostingService Primitive)
        ↓
Journal Lines & Proposed Entry Structure (ex-tax inventory, input ITC, AP)
        ↓
Double-Entry Validation (PostingService.validateJournalLines)
        ↓
SUBMITTED (Forward-only state transition)
```

In accordance with strict gate boundaries:
- **No permanent purchases** were created.
- **No permanent cost lots** or **inventory movements** were created.
- **`branch_inventory`** remained completely untouched at exactly **424** rows.
- **No COGS** was posted.
- **No purchase payments** or **AP settlements** occurred.
- **Fiscal periods** and **`accounting_start_date`** remain **UNCONFIGURED** in the live database.
- **No packaging products** were seeded into the catalog.
- All voucher drafting and submission testing was executed under a strict, rollback-guarded PostgreSQL transaction.

---

## 2. Architecture & Double-Entry Accounting Treatment

### A. General Ledger Mapping & Chart of Accounts Grounding

Every approved purchase invoice computes exact line-item values, tax components, and freight allocations using `calculatePurchaseTaxesAndTotals`, generating double-entry journal lines referencing verified Chart of Accounts rows:

| Account Code | Account Name | Normal Balance | Accounting Subtype | Role in Purchase Voucher |
| :--- | :--- | :--- | :--- | :--- |
| **`1131`** | Merchandise Inventory - Accessories | Debit | `INVENTORY` | Debited for taxable value (+ capitalized attributable freight) of accessory merchandise. |
| **`1132`** | Merchandise Inventory - Cakes | Debit | `INVENTORY` | Debited for taxable value (+ capitalized attributable freight) of cake merchandise. |
| **`1133`** | Packaging Supplies Stock | Debit | `INVENTORY` | Debited for taxable value of packaging supplies (both catalog & non-catalog lines). |
| **`1141`** | Input CGST 2.5% (Food/Bakery) | Debit | `INPUT_TAX` | Debited for Central GST on food/bakery items (intra-state). |
| **`1142`** | Input SGST 2.5% (Food/Bakery) | Debit | `INPUT_TAX` | Debited for State GST on food/bakery items (intra-state). |
| **`1143`** | Input CGST 9.0% (Accessories/General) | Debit | `INPUT_TAX` | Debited for Central GST on accessories/packaging (intra-state). |
| **`1144`** | Input SGST 9.0% (Accessories/General) | Debit | `INPUT_TAX` | Debited for State GST on accessories/packaging (intra-state). |
| **`1145`** | Input IGST 5.0% (Interstate Food) | Debit | `INPUT_TAX` | Debited for Integrated GST on interstate food merchandise. |
| **`1146`** | Input IGST 18.0% (Interstate Accessories) | Debit | `INPUT_TAX` | Debited for Integrated GST on interstate accessories/packaging. |
| **`5240`** | Freight & Cartage Inward | Debit | `OPERATING_EXPENSE` | Debited when freight policy is `OPERATING_EXPENSE` (excluded from inventory cost). |
| **`2111`** | Accounts Payable | Credit | `PAYABLE` | Credited for the total vendor invoice payable (`taxCalc.invoiceTotal`). |

### B. Invariant Validations Enforced
1. **Mathematical Balance**:
   $$\sum \text{Debits} \equiv \sum \text{Credits} \equiv \text{Invoice Total}$$
   Verified by `PostingService.validateJournalLines(journalLines)` with strict single-sided exclusivity (`debit > 0 XOR credit > 0; non-negative`).
2. **Recoverable GST Exclusion**:
   Input GST (CGST/SGST/IGST) is debited directly to `114x` asset accounts (Input Tax Credit) and is **strictly excluded** from inventory asset accounts (`1131`, `1132`, `1133`).
3. **Freight Capitalization vs. OPEX**:
   - `INVENTORY_CAPITALIZED`: Freight is allocated pro-rata across eligible merchandise lines (`product_id` + `variant_id` required) and capitalized into the inventory cost basis debited to `1131`/`1132`. Account `5240` receives zero debits.
   - `OPERATING_EXPENSE`: Freight is debited to Account `5240` (Freight & Cartage Inward) and excluded from inventory lot costs.
4. **Header Trade Discount Allocation**:
   Apportioned pro-rata based on net line value with exact penny residual assigned to final line, guaranteeing:
   $$\sum \text{taxable\_value} \equiv \text{subtotal} - \text{total\_discount}$$
5. **Voucher Lifecycle Status**:
   - Vouchers are constructed in `DRAFT` status via `PostingService.createVoucherDraft`.
   - Vouchers transition to `SUBMITTED` status via `PostingService.submitVoucher`.
   - `POSTED` status is strictly blocked until Step 3D.4 (atomic purchase posting + inventory lot commit).
6. **Segregation of Duties (SoD)**:
   - Voucher submitter recorded via server session (`submitted_by`).
   - Voucher cannot be posted directly from `SUBMITTED` without an explicit `APPROVED` transition by an authorized supervisor distinct from the creator.

---

## 3. Implementation Details

### File Modified: `frontend/src/lib/services/purchase-posting.service.ts`

1. **Integrated Frozen Step 3D.1 Tax Engine**:
   - Imported `calculatePurchaseTaxesAndTotals`, `TaxEngineError`, and calculation interfaces.
   - Refactored `inspectAndBuildJournalLines` to accept optional freight overrides, query supplier tax profile (`gstin`, `state`), query receiving branch tax jurisdiction (`metadata->'state'`, `city.state`), and execute `calculatePurchaseTaxesAndTotals`.
   - Reconciles calculated `invoiceTotal` against `purchase.total` (fail-closed with `PURCHASE_TOTAL_MISMATCH` on variance > 0.05).
   - Generates double-entry journal lines referencing verified active CoA accounts and calls `PostingService.validateJournalLines`.

2. **Upgraded `createPurchaseVoucherDraft`**:
   - Accepts `freightPolicy`, `freightAmount`, and `isFreightBilledOnInvoice` options.
   - Computes `fiscalYear` (from configured DB period or derives standard Indian fiscal year format `FY2026-27`), allowing DRAFT voucher construction without violating the requirement that live accounting start date remain unconfigured in this step.
   - Calls `PostingService.createVoucherDraft` to create the voucher in `DRAFT` status with source idempotency (`PURCHASE:<purchase_id>:INVOICE_POSTED`).
   - Sets `voucher.total_amount = totalPayable` and stores `tax_calculation` and `proposed_journal_lines` in `voucher.metadata`.

3. **Added `submitPurchaseVoucher`**:
   - Validates voucher existence and branch isolation (BOLA defense).
   - Enforces `voucher.status === 'DRAFT'`.
   - Transitions voucher to `SUBMITTED` status via canonical `PostingService.submitVoucher`.

4. **Added `previewPurchaseVoucher`**:
   - Provides a read-only simulation endpoint returning `{ purchase, tax_calculation, journal_lines, total_payable, is_balanced: true }` without mutating database state.

---

## 4. Verification & Test Evidence

### A. Step 3D.2 Test Suite (`frontend/scratch/test_step3d2_voucher_construction.js`)
**Result: 67 / 67 PASSED (100%)**
Executed within an isolated transaction with automatic `ROLLBACK`:

| Test Group | Scenario | Key Assertions Verified | Status |
| :--- | :--- | :--- | :--- |
| **Group 1** | Intra-State Purchase Voucher (Cakes + Accessories) | Preview succeeds, jurisdiction `INTRA_STATE`, voucher `DRAFT` created with `total_amount = 7610.00`, 7 lines constructed (`Dr 1132` 5000, `Dr 1131` 2000, `Dr 1141` 125, `Dr 1142` 125, `Dr 1143` 180, `Dr 1144` 180, `Cr 2111` 7610), debits = credits = 7610.00, transitioned `DRAFT` → `SUBMITTED`. | **PASS** |
| **Group 2** | Inter-State Purchase Voucher (Packaging) | Jurisdiction `INTER_STATE`, voucher `DRAFT` created with `total_amount = 2950.00`, 3 lines constructed (`Dr 1133` 2500, `Dr 1146` 450, `Cr 2111` 2950), debits = credits = 2950.00, transitioned to `SUBMITTED`. | **PASS** |
| **Group 3** | Operating Expense Freight Purchase | Freight policy `OPERATING_EXPENSE` (400.00 billed on invoice), 5 lines (`Dr 1132` 4000, `Dr 5240` 400, `Dr 1141` 100, `Dr 1142` 100, `Cr 2111` 4600), debits = credits = 4600.00, freight excluded from inventory valuation. | **PASS** |
| **Group 4** | Capitalized Attributable Freight Purchase | Freight policy `INVENTORY_CAPITALIZED` (300.00), Cake line (60%) debited 3180.00 (3000 + 180), Accessory line (40%) debited 2120.00 (2000 + 120), Account 5240 NOT debited, debits = credits = 5810.00. | **PASS** |
| **Group 5** | Header Discount Distribution | 500.00 header discount distributed across lines, cent residual assigned to final line, debits = credits = 9975.00 reconciles exactly. | **PASS** |
| **Group 6** | Unregistered Supplier Invoice | Unregistered vendor, 0 input tax lines created, 2 lines total (`Dr 1132` 3000, `Cr 2111` 3000), debits = credits = 3000.00. | **PASS** |
| **Group 7** | Fail-Closed Security & Integrity Checks | Unapproved purchase fails (`INVALID_PURCHASE_STATUS`), total mismatch fails (`PURCHASE_TOTAL_MISMATCH`), cross-branch BOLA access rejected (`BRANCH_ACCESS_DENIED`), re-submitting submitted voucher fails (`INVALID_VOUCHER_STATE`), posting submitted voucher without approval fails (`INVALID_VOUCHER_STATE`). | **PASS** |
| **Group 8** | Rollback & Invariant Verification | `ROLLBACK` issued; PostgreSQL tables verified empty of test artifacts. | **PASS** |

### B. Step 3D.1 Tax Engine Suite (`frontend/scratch/test_purchase_tax_engine.js`)
**Result: 58 / 58 PASSED (100%)**
Confirmed zero regressions in the frozen tax and calculation engine.

### C. Independent PostgreSQL Baseline Audit (`verify_phase4f_step3c22_independent.js`)
**Result: 20 / 20 PASSED (100%)**
Direct database inspection against live PostgreSQL:
- `accounting_account = 98` (baseline intact)
- `accounting_voucher = 0` (zero persisted test vouchers)
- `accounting_journal_entry = 0` (zero persisted test journals)
- `accounting_journal_line = 0` (zero persisted test lines)
- `accounting_fiscal_period = 0` (unconfigured as required)
- `purchase = 0`, `purchase_item = 0`, `purchase_payment = 0`
- `branch_inventory = 424` (zero mutations)
- `order = 173`, `payment_transaction = 53`
- `inventory_cost_lot = 0`, `inventory_movement = 0`, `inventory_cost_consumption = 0`
- `packaging products = 0` (zero synthetic catalog rows)
- `accounting_start_date = UNCONFIGURED`

### D. Security Regression Suite (`scratch/run_security_regression.js`)
**Result: 21 / 21 PASSED (100%)**
- CRIT-01 (API permission & x-user-role spoofing): PASS
- CRIT-02 (JWT signature & session verification): PASS
- HIGH-03 (Admin privilege escalation): PASS
- HIGH-04 (Customer order isolation): PASS
- HIGH-05 (Profile endpoint IDOR & body sanitization): PASS
- HIGH-06 (Zero hardcoded credentials in db.ts): PASS
- HIGH-07 (SSRF validator RFC 1918 & metadata defense): PASS

### E. TypeScript Compiler
**Result: 0 ERRORS** (`npx tsc --project tsconfig.json --noEmit` exited with code 0).

---

## 5. Decision Lock for Next Step (Step 3D.3)

With Step 3D.2 successfully completed and verified:
1. **Purchase Tax Engine** (Step 3D.1) is frozen.
2. **Purchase Accounting Voucher Construction** (Step 3D.2) is verified and frozen:
   - Validates purchase totals.
   - Creates vouchers in `DRAFT`.
   - Builds balanced, single-sided double-entry lines (`1131`, `1132`, `1133`, `5240`, `1141-1146`, `2111`).
   - Transitions vouchers to `SUBMITTED`.
3. **Step 3D.3 — Voucher Accounting Approval & Segregation of Duties**:
   - Focuses strictly on the transition `SUBMITTED → APPROVED`.
   - Enforces distinct actors (`voucher.approved_by !== voucher.created_by`).
   - Enforces role-based permissions (`ACCOUNTING_APPROVER` / `FINANCE_CONTROLLER`).
   - Maintains vouchers in `APPROVED` status awaiting the atomic posting step (Step 3D.4).
   - Zero physical inventory or GL posting until Step 3D.4.
