# Phase 4F Step 3D.1 Checkpoint: Purchase Tax & Total Calculation Engine

**Status:** PASS ✅  
**Date:** September 24, 2026 — 20:50:00 UTC+05:30  
**Operating Branch:** `task/dev`  
**HEAD Commit:** `f7d9a47073d64b0da305cc537a6eccb45938fd1b` (no commits made)  
**Verification Baseline:**
- `accounting_account = 98`
- `accounting_voucher = 0`
- `accounting_journal_entry = 0`
- `accounting_journal_line = 0`
- `accounting_fiscal_period = 0`
- `purchase = 0`
- `purchase_item = 0`
- `purchase_payment = 0`
- `branch_inventory = 424`
- `order = 173`
- `payment_transaction = 53`
- `inventory_cost_lot = 0`
- `inventory_movement = 0`
- `inventory_cost_consumption = 0`
- `packaging products in database = 0`
- `accounting_start_date = UNCONFIGURED`

---

## 1. Executive Summary

Phase 4F Step 3D.1 implements the deterministic, zero-mutation **Purchase Tax, Discount, Freight & Total Calculation Engine** (`PurchaseTaxEngine`). This calculation engine resolves all architectural design locks established during the Step 3D design review:
1. **Deterministic GST Jurisdiction**:
   - Replaced naive string matching with canonical 2-digit GST state codes directory (`GST_STATE_DIRECTORY`).
   - Resolves supplier location via GSTIN state prefix (e.g. `29` -> Karnataka, `27` -> Maharashtra) with declared state consistency validation.
   - Fails closed (`TAX_JURISDICTION_CONFLICT` or `TAX_JURISDICTION_UNRESOLVED`) on missing or conflicting location claims.
   - Accurately branches into `INTRA_STATE` (CGST 50% + SGST 50%), `INTER_STATE` (IGST 100%), and `UNREGISTERED` (0 tax).
2. **Deterministic Header Discount Allocation**:
   - Implemented pro-rata allocation across line items based on net line value (`gross_value - line_discount`).
   - Guarantees exact penny residual adjustment on the final line item (`allocatedHeaderDiscount[last] = headerDiscount - sum(allocated[0..n-2])`).
   - Proves `subtotal - total_discount === taxable_value` with $0.00$ variance.
3. **Explicit Freight Treatment Policy**:
   - `INVENTORY_CAPITALIZED`: Apportions freight pro-rata across eligible catalog merchandise line items (`is_inventory_eligible = true`), adjusting the final eligible line for penny residuals.
   - `OPERATING_EXPENSE`: Keeps freight separate for debiting to Account `5240` ("Freight & Cartage Inward"), excluding it from merchandise cost lot valuation.
4. **Ex-Tax Inventory Cost Basis**:
   - Excludes recoverable GST from inventory cost layers.
   - Computes inventory lot total cost as `taxable_value + allocated_freight`.
   - Computes lot unit cost as `lot_total_cost / quantity`.
5. **Inventory Eligibility Enforcement**:
   - Only lines with both `product_id` AND `variant_id` are flagged as `is_inventory_eligible = true`.
   - Unlinked / service lines (`product_id = null`) are barred from receiving inventory freight allocation or generating physical inventory movements.

---

## 2. Implementation Artifacts

1. **Calculation Engine Module** ([`frontend/src/lib/services/purchase-tax-engine.ts`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/purchase-tax-engine.ts)):
   - Pure, stateless TypeScript implementation with zero side-effects and zero database dependencies.
   - Includes canonical 38 Indian State / UT GST directory, normalization utilities, strict validation, and reconciliation invariants.
2. **Unit & Integration Test Suite** ([`frontend/scratch/test_purchase_tax_engine.js`](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/scratch/test_purchase_tax_engine.js)):
   - 58 automated test cases covering state lookups, jurisdiction branching, tax calculations, discount allocations, residual adjustments, freight policies, and validation rejections.

---

## 3. Verification Evidence

### A. Calculation Engine Suite (`scratch/test_purchase_tax_engine.js`)
- **Group 1: State Directory Lookup**: 4/4 PASS (Code `29`, Alpha `MH`, Name `Kerala`, Invalid null).
- **Group 2: Jurisdiction Resolution**: 6/6 PASS (Intra `29`->`29`, Inter `27`->`29`, URD, Conflict detection, Missing state rejection).
- **Group 3: Intra-State Tax Calculation**: 16/16 PASS (CGST/SGST rates and amounts, ex-tax lot unit costs, invoice total).
- **Group 4: Inter-State Tax Calculation**: 5/5 PASS (IGST rate and amount, 0 CGST/SGST).
- **Group 5: Unregistered Supplier (URD)**: 2/2 PASS (0 tax, invoice total equals taxable value).
- **Group 6: Header Discount Allocation**: 7/7 PASS (16.67 + 33.33 + 50.00 = 100.00 exact reconciliation, penny residual guarantee).
- **Group 7: Freight Policies**: 15/15 PASS (Inventory capitalization across eligible lines only, operating expense separation, lot cost alignment).
- **Group 8: Validation Rejections**: 3/3 PASS (Discount > base, negative rates, empty items).
- **Total Engine Tests**: **58 / 58 PASS (100%)**

### B. Independent PostgreSQL Verification (`scratch/verify_phase4f_step3c22_independent.js`)
- `accounting_account = 98` (PASS)
- `accounting_voucher = 0` (PASS)
- `accounting_journal_entry = 0` (PASS)
- `accounting_journal_line = 0` (PASS)
- `accounting_fiscal_period = 0` (PASS)
- `purchase = 0` (PASS)
- `purchase_item = 0` (PASS)
- `purchase_payment = 0` (PASS)
- `branch_inventory = 424` (PASS)
- `order = 173` (PASS)
- `payment_transaction = 53` (PASS)
- `inventory_cost_lot = 0` (PASS)
- `inventory_movement = 0` (PASS)
- `inventory_cost_consumption = 0` (PASS)
- `packaging products in database = 0` (PASS)
- `accounting_start_date = UNCONFIGURED` (PASS)
- **Total Independent DB Checks**: **20 / 20 PASS (0 failed)**

### C. Security Regression Suite
- Ran `scripts/run-security-regression-tests.ps1` & `scratch/run_security_regression.js`:
  - **Result: 21 / 21 PASS (100%)**

### D. TypeScript Compilation
- Executed `npx tsc --project tsconfig.json --noEmit` in `frontend`:
  - **Result: 0 errors, 0 diagnostics (Exit code 0)**

### E. Git Invariants
- Operating branch: `task/dev`, HEAD: `f7d9a47`.
- Zero commits, zero pushes.

---

## 4. Next Step in Sequence

Per the approved execution sequence:
- **Completed**: Step 3D.1 (Purchase Tax + Total Calculation Engine)
- **Next**: **Step 3D.2 — Purchase Accounting Voucher Construction**
  - Construct balanced DRAFT accounting vouchers using the output of `PurchaseTaxEngine`.
  - Account mapping: DR 1131/1132/1133 (Inventory), DR 1141/1142/1143 (Input GST), DR 5240 (Freight if Operating Expense), CR 2111 (Trade Payables).
  - Enforce voucher creation SoD and double-entry mathematical balance.
