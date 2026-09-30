# Phase 4F Step 4.1 Checkpoint: Sales Tax & Calculation Engine

**Status:** PASS ✅  
**Date:** September 26, 2026 — 10:05:00 UTC+05:30  
**Operating Branch:** `task/dev`  
**HEAD Commit:** `f7d9a47073d64b0da305cc537a6eccb45938fd1b` (clean workspace, no unauthorized commits)  
**Verification Baseline:**
- `accounting_account = 98`
- `accounting_voucher = 0`
- `accounting_journal_entry = 0`
- `accounting_journal_line = 0`
- `accounting_fiscal_period = 0`
- `purchase = 0`
- `purchase_item = 0`
- `purchase_payment = 0`
- `supplier = 0`
- `branch = 57`
- `branch_inventory = 424`
- `inventory_cost_lot = 0`
- `inventory_movement = 0`
- `inventory_cost_consumption = 0`
- `order = 173` (quarantined prototype data)
- `payment_transaction = 53` (quarantined prototype data)
- `setting = 16`
- `accounting.start_date = UNCONFIGURED (0 rows)`

---

## 1. Executive Summary

Phase 4F Step 4.1 establishes the pure, deterministic **Sales Tax & Calculation Engine** (`SalesTaxEngine` / `calculateSalesTaxAndTotals`) at `frontend/src/lib/services/sales-tax-engine.ts`. 

In strict adherence to the authorized scope:
1. **Zero Database Mutations & Zero Accounting Posting**: The engine is purely stateless and functional. It performs no database writes, creates no vouchers, posts no journals, consumes no inventory cost-lots, alters no branch inventory, and creates no AR records.
2. **Deterministic Place of Supply (POS) Resolution**: Compares the selling branch state against the customer delivery state using the canonical 38 Indian State / UT GST directory (`GST_STATE_DIRECTORY` & `lookupGstState`). Correctly classifies transactions as `INTRA_STATE` or `INTER_STATE`. Fails closed if state information is missing or contradictory.
3. **Fail-Closed Tax Classification & Rate Validation**: Strictly enforces valid GST rates (`5%` for Cakes/Bakery, `18%` for Accessories, `12%` for Toys, `0%` for Exempt/Nil-rated, `28%` for Luxury). If an item has an unsupported, negative, or undefined tax rate, the engine fails closed with explicit error codes (`MISSING_TAX_RATE`, `UNSUPPORTED_TAX_RATE`, `INVALID_RATE`). Never defaults or guesses rates.
4. **GST Split**:
   - `INTRA_STATE`: 50% CGST, 50% SGST, 0% IGST.
   - `INTER_STATE`: 100% IGST, 0% CGST, 0% SGST.
   - Guarantees no simultaneous CGST/SGST and IGST.
5. **Deterministic Pro-Rata Header/Coupon Discount Allocation**: Pro-rata distributes order-level discounts across eligible taxable lines based on net line value (`gross_value - line_discount`). Applies deterministic penny/paise residual reconciliation to the line with the largest net line value, guaranteeing that:
   - Line taxable values never become negative.
   - The sum of line taxable values exactly equals `gross_line_total - total_discounts`.
   - Sum of allocated discounts strictly equals the order discount amount without rounding drift.
6. **Delivery Fee Tax Handling**: Supports delivery fee taxation with fail-closed semantics. If `delivery.amount > 0` and `taxRatePercent` is not provided, the engine throws `MISSING_DELIVERY_TAX_RATE`. Free delivery (`amount = 0`) correctly produces 0 tax.
7. **Suggested CoA Mapping Metadata**: Annotates lines with authoritative Chart of Accounts mappings for later voucher construction (Step 4.2):
   - Revenue: `4110` (Cake Revenue), `4120` (Accessory Revenue), `4130` (Delivery Revenue).
   - Output GST: `2121`/`2122` (Bakery CGST/SGST 2.5%), `2125` (Bakery IGST 5%), `2123`/`2124` (Accessories CGST/SGST 9%), `2126` (Accessories IGST 18%), `2127`/`2128` (Toys CGST/SGST 6%), `2129` (Toys IGST 12%).
   - AR Control: `1121` (Accounts Receivable for online prepaid) vs `1122` (Undeposited COD Collections for Cash-on-Delivery).
8. **Mathematical Invariant & Paise Arithmetic**: All intermediate values maintain strict rounding identities:
   - `invoiceTotal === taxableValue + totalTax + (delivery ? delivery.totalAmount : 0)`
   - `totalTax === cgst + sgst + igst`
   - Every monetary line is guaranteed to be an exact integer number of paise.

---

## 2. Exact Files Changed / Created

| File | Type | Change Description |
|---|---|---|
| `frontend/src/lib/services/sales-tax-engine.ts` | **New File** | Canonical sales tax & total calculation engine module. Deterministic, side-effect free, fail-closed validation, pro-rata discount allocation, POS resolution, and suggested accounting metadata resolution. |
| `frontend/scratch/test_sales_tax_engine.js` | **New File** | Step 4.1 test harness containing 121 assertions covering all 30 mandatory test categories. |
| `CHECKPOINTS/phase4f-step4-1-sales-tax-engine-01.md` | **New File** | This formal milestone completion checkpoint. |
| `CHECKPOINTS/LATEST_CHECKPOINT.md` | **Updated** | Updated index pointer to Phase 4F Step 4.1. |
| `frontend/LATEST_CHECKPOINT.md` | **Updated** | Updated frontend index pointer to Phase 4F Step 4.1. |

*Zero other application files or database migration scripts were modified.*

---

## 3. Test Suite Verification & Metrics

### A. Dedicated Step 4.1 Test Suite (`frontend/scratch/test_sales_tax_engine.js`)
All 30 mandatory test categories specified in Section 11 of the authorization prompt were executed and validated:

| Category | Description | Status | Assertions Passed |
|---|---|---|---|
| 1 | Intra-state bakery/cake 5% | PASS ✅ | 11 |
| 2 | Interstate bakery/cake 5% | PASS ✅ | 7 |
| 3 | Intra-state accessory 18% | PASS ✅ | 8 |
| 4 | Interstate accessory 18% | PASS ✅ | 4 |
| 5 | Intra-state toy 12% | PASS ✅ | 4 |
| 6 | Interstate toy 12% | PASS ✅ | 4 |
| 7 | Multiple lines with different tax rates | PASS ✅ | 8 |
| 8 | Header discount with proportional allocation | PASS ✅ | 10 |
| 9 | Discount residual paise allocation | PASS ✅ | 2 |
| 10 | Multiple quantities calculation | PASS ✅ | 5 |
| 11 | Zero/invalid quantity rejection (fails closed) | PASS ✅ | 2 |
| 12 | Negative price rejection (fails closed) | PASS ✅ | 1 |
| 13 | Missing branch state rejection (fails closed) | PASS ✅ | 1 |
| 14 | Missing customer state rejection (fails closed) | PASS ✅ | 1 |
| 15 | Same-state jurisdiction resolution (INTRA_STATE) | PASS ✅ | 2 |
| 16 | Different-state jurisdiction resolution (INTER_STATE) | PASS ✅ | 2 |
| 17 | Unsupported tax rate rejection (fails closed) | PASS ✅ | 1 |
| 18 | Missing tax classification rejection (fails closed) | PASS ✅ | 1 |
| 19 | Tax arithmetic identity (`totalTax === cgst + sgst + igst`) | PASS ✅ | 1 |
| 20 | Invoice total identity (`taxable + totalTax + delivery`) | PASS ✅ | 1 |
| 21 | CGST + SGST = total intra-state GST identity | PASS ✅ | 4 |
| 22 | IGST = total interstate GST identity | PASS ✅ | 3 |
| 23 | No simultaneous CGST/SGST and IGST invariant | PASS ✅ | 2 |
| 24 | Deterministic repeated calculation (100 iterations byte-for-byte) | PASS ✅ | 1 |
| 25 | Delivery fee tax behavior & fail-closed validation | PASS ✅ | 9 |
| 26 | Rounding edge cases & paise precision | PASS ✅ | 6 |
| 27 | Discount cannot create negative taxable value | PASS ✅ | 2 |
| 28 | Mixed taxable lines (item discount + header discount) | PASS ✅ | 7 |
| 29 | Exact paise preservation across all totals | PASS ✅ | 4 |
| 30 | Fail-closed invalid inputs & AR control resolution | PASS ✅ | 7 |

- **Step 4.1 Tests Executed:** 121
- **Step 4.1 Passed:** **121 / 121 (100%)**
- **Step 4.1 Failures:** **0**

### B. Upstream Accounting Regression Suites
All upstream purchase and accounting modules were executed to verify zero regression across the existing ERP foundation:

1. `test_purchase_tax_engine.js`: **58 / 58 PASS** (100%)
2. `test_step3d2_voucher_construction.js`: **67 / 67 PASS** (100%)
3. `test_step3d3_voucher_approval.js`: **82 / 82 PASS** (100%)
4. `test_step3d4_atomic_posting.js`: **136 / 136 PASS** (100%)
5. `test_step3d5_purchase_payment.js`: **99 / 99 PASS** (100%)
6. `test_step3d6a_purchase_return.js`: **121 / 121 PASS** (100%)
7. `test_step3d6b_purchase_reversal.js`: **101 / 101 PASS** (100%)
8. `test_step3d7a_payment_reversal.js`: **100 / 100 PASS** (100%)
9. `test_step3d7b_ap_subledger.js`: **142 / 142 PASS** (100%)

- **Total Upstream Accounting Tests:** **806 / 806 PASS (100%)**
- **Upstream Failures:** **0**

### C. Security Regression Suite (`scripts/run-security-regression-tests.ps1`)
- **CRIT-01 (API Auth & Context):** 2 / 2 PASS
- **CRIT-02 (Client Spoofing Defense):** 3 / 3 PASS
- **HIGH-03 (Admin Role Verification):** 3 / 3 PASS
- **HIGH-04 (Orders BOLA/IDOR):** 3 / 3 PASS
- **HIGH-05 (Profile BOLA/IDOR):** 3 / 3 PASS
- **HIGH-06 (Database Secret Remediation):** 3 / 3 PASS
- **HIGH-07 (Webhook SSRF Protection):** 4 / 4 PASS
- **Total Security Tests:** **21 / 21 PASS (100%)**
- **Security Failures:** **0**

### D. TypeScript Static Analysis
- Command: `npx tsc --noEmit`
- Result: **0 errors, 0 warnings (Exit code 0)**

---

## 4. Independent PostgreSQL Baseline Verification

An independent forensic audit of the PostgreSQL database was executed before and after running all test suites:

| Table / Entity | Baseline Count (Pre-Step 4.1) | Post-Test Count | Delta | Confirmation |
|---|---|---|---|---|
| `accounting_account` | 98 | 98 | 0 | CoA untouched |
| `accounting_voucher` | 0 | 0 | 0 | Zero vouchers created |
| `accounting_journal_entry` | 0 | 0 | 0 | Zero journal entries |
| `accounting_journal_line` | 0 | 0 | 0 | Zero journal lines |
| `accounting_fiscal_period` | 0 | 0 | 0 | Zero fiscal periods |
| `purchase` | 0 | 0 | 0 | Untouched |
| `purchase_item` | 0 | 0 | 0 | Untouched |
| `purchase_payment` | 0 | 0 | 0 | Untouched |
| `supplier` | 0 | 0 | 0 | Untouched |
| `branch` | 57 | 57 | 0 | Untouched |
| `branch_inventory` | 424 | 424 | 0 | Zero inventory changes |
| `inventory_cost_lot` | 0 | 0 | 0 | Zero cost lots |
| `inventory_movement` | 0 | 0 | 0 | Zero inventory movements |
| `inventory_cost_consumption` | 0 | 0 | 0 | Zero COGS consumptions |
| `order` | 173 | 173 | 0 | Quarantined prototype data |
| `payment_transaction` | 53 | 53 | 0 | Quarantined prototype data |
| `setting` | 16 | 16 | 0 | Untouched |
| `accounting.start_date` | UNCONFIGURED | UNCONFIGURED | 0 | Unconfigured |

**Audit Confirmation:**
1. Zero database mutations were committed.
2. Zero accounting postings (sales, purchase, inventory, or cash) occurred.
3. The 173 historical orders and 53 historical payment transactions remain strictly quarantined as `LEGACY_PROTOTYPE_DATA`.
4. `accounting.start_date` remains unconfigured.

---

## 5. Architectural Alignment & Purchase Engine Consistency

The Sales Tax Engine reuses canonical infrastructure established during Phase 4F Step 3D.1:
1. **Shared State Directory**: Reuses `GST_STATE_DIRECTORY` and `lookupGstState` from `purchase-tax-engine.ts` to prevent duplication of the 38 Indian State / UT mappings.
2. **Shared Rounding Utilities**: Reuses `round2` and `round4` for exact monetary precision.
3. **Intentional Domain Differences**:
   - **Freight vs Delivery Fee**: On purchases, freight is either capitalized into merchandise cost-lot layers (`INVENTORY_CAPITALIZED`) or booked to operating expense (`5240 Freight Inward`). On sales, delivery fees represent a taxable outward service billed to the customer and earned as revenue (`4130 Delivery Fee Revenue`), generating output GST rather than ITC.
   - **Recoverability vs Output Liability**: Purchase tax calculates input tax credit (ITC) debited to asset accounts `1131`-`1136`. Sales tax calculates output tax liability credited to liability accounts `2121`-`2129`.
   - **Discount Application**: Purchase discounts reduce supplier payable and inventory capitalization. Sales discounts reduce customer receivables and gross revenue across taxable product lines.

---

## 6. Known Limitations & Frozen Invariants

1. **Step 4.1 Boundary**: This engine only computes tax and totals; it does not construct accounting vouchers, post entries, or interact with AR.
2. **Delivery Fee Tax Classification**: Per design rules, if delivery fee is taxable and billed, its rate must be explicitly provided by the caller or fail closed. The engine does not guess delivery tax rates.
3. **No Historical Backfill**: Historical orders (173 rows) will never be processed or posted by this engine.

---

## 7. Next Milestone

**Next Authorized Milestone:**  
`PHASE 4F STEP 4.2 — SALES VOUCHER CONSTRUCTION`  
*(Awaiting explicit user authorization before proceeding)*
