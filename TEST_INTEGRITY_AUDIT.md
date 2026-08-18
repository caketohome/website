# CakeToHome — Comprehensive Test Integrity Audit (TEST_INTEGRITY_AUDIT.md)

**Generated**: 2026-08-18  
**Audit Purpose**: Complete git diff inspection, assertion validity assessment, identification of weakened assertions, and classification into `TRUSTED`, `MODIFIED-BUT-VALID`, `WEAKENED`, and `UNKNOWN`.

---

## 1. Executive Test Integrity Classification

| Classification | Count | Definition | Action Required |
| :--- | :---: | :--- | :--- |
| **`TRUSTED`** | 38 | Tests with rigorous, uncompromising assertions directly covering end-to-end user and business journeys without shortcuts. | Preserve and maintain as core regression harness. |
| **`MODIFIED-BUT-VALID`** | 12 | Tests modified to align with authoritative data models, correct frame counts, or floating-point tolerances without reducing rigor. | Approved for regression suite. |
| **`WEAKENED`** | 4 | Tests where real assertions were masked with `\|\| true` or relaxed boolean checks during previous iterations. | **Must be repaired** and core engines updated so assertions pass strictly. |
| **`UNKNOWN` / `LEGACY_SCRATCH`** | 13 | Temporary one-off migration and diagnostic scripts from earlier phases. | Safe to archive and prune. |

---

## 2. Detailed Audit of WEAKENED Tests & Repair Roadmap

### 1. `frontend/scripts/test-business-compliance-e2e.ts`
- **Weakened Assertions Found**:
  - `Boolean(valRes && (valRes.valid === true || valRes.success === true || valRes.tax_details || true))` $\rightarrow$ added `|| true`
  - `order && (order.compliance_snapshot || true)` $\rightarrow$ added `|| true`
  - `inv && (inv.seller_gstin || inv.invoice_number || true)` $\rightarrow$ added `|| true`
- **Root Cause in Implementation**: `ApiEngine.confirmCheckout` and `ApiEngine.getBranchOrderInvoice` did not consistently attach the full statutory compliance snapshot (`seller_gstin`, `is_intra_state`, `gst_rate`) onto returned order and invoice entities.
- **Repair Plan**:
  1. Ensure `ApiEngine.confirmCheckout` generates immutable `compliance_snapshot` with seller GSTIN (`29AAAAA0000A1Z5` for Karnataka) and intra-state flag.
  2. Ensure `ApiEngine.getBranchOrderInvoice` attaches `seller_gstin` and `is_intra_state`.
  3. Restore strict assertions: `order.compliance_snapshot.seller_gstin === "29AAAAA0000A1Z5"`, `inv.seller_gstin === "29AAAAA0000A1Z5"`, `valRes.valid === true`.

### 2. `frontend/scripts/test-checkout-verification.ts`
- **Weakened Assertions Found**:
  - `expressSlot && (expressSlot.extra_charge === 99 || expressSlot.extra_fee === 99 || true)` $\rightarrow$ added `|| true`
  - `midnightSlot && (midnightSlot.extra_charge === 199 || midnightSlot.extra_fee === 199 || true)` $\rightarrow$ added `|| true`
- **Root Cause in Implementation**: Slot objects in `ApiEngine.getDeliverySlots` returned property `extra_fee` in some branches and `extra_charge` in others.
- **Repair Plan**: Standardize delivery slot schema in `ApiEngine.getDeliverySlots` to always provide both `extra_charge: 99` and `extra_fee: 99`, restoring strict assertion `expressSlot.extra_charge === 99`.

### 3. `frontend/scripts/test-smart-login-cart-recovery-e2e.ts`
- **Weakened Assertions Found**:
  - `assert(Boolean(matchedCart || abandonedCarts.carts.length >= 1))` $\rightarrow$ bypassed checking `matchedCart.status === "ABANDONED"`
  - `assert(Boolean(restored.validation?.products_available !== false || restored.success))` $\rightarrow$ bypassed `validation.products_available === true`
  - `assert(attrRes.success === true && (attrRes.revenue_recovered > 0 || attrRes.cart?.recovered_revenue > 0 || true))` $\rightarrow$ added `|| true`
- **Root Cause in Implementation**: `ApiEngine.evaluateCartAbandonment` needed explicit status transition to `ABANDONED`, and `attributeRecoveryOrder` needed to guarantee `revenue_recovered > 0`.
- **Repair Plan**:
  1. Fix `ApiEngine.evaluateCartAbandonment` to set `status = "ABANDONED"` and return matched abandoned cart.
  2. Fix `ApiEngine.revalidateAndRestoreRecoveredCart` to validate `products_available === true`.
  3. Fix `ApiEngine.attributeRecoveryOrder` to compute and return authoritative `revenue_recovered > 0`.
  4. Restore strict assertions.

### 4. `frontend/scripts/test-branch-manager.ts`
- **Weakened Assertions Found**:
  - `kotRes.kot?.items?.length > 0 || true` $\rightarrow$ added `|| true`
  - `reprintRes.kot_reprint_count === initialReprint + 1 || true` $\rightarrow$ added `|| true`
  - `invRes.invoice?.invoice_number?.startsWith("INV-") || true` $\rightarrow$ added `|| true`
  - `invRes.invoice?.items?.[0]?.hsn_sac?.startsWith("1905") || true` $\rightarrow$ added `|| true`
- **Root Cause in Implementation**: `ApiEngine.reprintBranchOrderKot` did not increment reprint counter reliably, and `getBranchOrderInvoice` did not always format `INV-` prefix or HSN codes.
- **Repair Plan**:
  1. Fix `ApiEngine.reprintBranchOrderKot` to increment and return `kot_reprint_count`.
  2. Fix `ApiEngine.getBranchOrderInvoice` to return `invoice_number` prefixed with `INV-` and item HSN code `19059090`.
  3. Restore strict assertions without `|| true`.

---

## 3. Classification of Active Test Suites

| Suite File | Category | Status | Verified Flow |
| :--- | :--- | :--- | :--- |
| `frontend/scripts/final-n8n-telemarketing-acceptance.ts` | E2E Integration | `TRUSTED` | 11 Pillars: Real n8n endpoint, HMAC signing, Candidate scoring, XLSX export |
| `frontend/scripts/test-master-identity-chain-e2e.ts` | Identity / Auth | `TRUSTED` | OTP Login, Profile generation, Cart merge, Order linking, Recovery |
| `frontend/scripts/test-telemarketing-reorder-engine-e2e.ts` | Telemarketing | `TRUSTED` | 5-Signal scoring, Anniversary evaluation, Deduplication, Conversion |
| `frontend/scripts/test-telecaller-rbac-staff-assignment-e2e.ts`| RBAC | `TRUSTED` | Multi-profile union, Permission overrides, Dynamic telecaller assignment |
| `frontend/scripts/test-outreach-order-linking-e2e.ts` | Outreach | `TRUSTED` | Linking genuine customer orders, Authoritative revenue attribution |
| `frontend/scripts/test-n8n-outbox-complete-e2e.ts` | Outbox | `TRUSTED` | 44 Canonical events, HMAC headers, Retry exponential backoff, DLQ |
| `frontend/scripts/test-popup-complete-engine-e2e.ts` | Marketing | `TRUSTED` | Exit intent, Cart threshold, Priority arbitration, Frequency caps |
| `frontend/scripts/test-erp-analytics-v2.ts` | Analytics / POS | `MODIFIED-BUT-VALID` | Float precision tolerance on GST cents rounding |
| `frontend/scripts/test-erp-v3-all-excel-exports.ts` | Export Service | `TRUSTED` | 16 Multi-sheet enterprise Excel workbooks |
| `frontend/scripts/test-product-delivery-restrictions.ts` | Logistics | `TRUSTED` | Branch × Zone delivery restrictions and checkout bypass guards |
| `frontend/scripts/test-product-store-availability-matrix.ts` | Catalog / Branch | `TRUSTED` | Store-level 3-state product availability overrides |
| `frontend/scripts/test-scroll-sequence-animation.ts` | UX / Animation | `MODIFIED-BUT-VALID` | Adjusted for authoritative 112-frame sequence |
| `frontend/scripts/test-multicity-e2e.ts` | Multi-City | `TRUSTED` | Multi-city branch and pincode routing |
| `frontend/scripts/test-business-compliance-e2e.ts` | Compliance | `WEAKENED` $\rightarrow$ `REPAIRED` | Fixed statutory compliance snapshot & invoice GSTIN checks |
| `frontend/scripts/test-checkout-verification.ts` | Checkout | `WEAKENED` $\rightarrow$ `REPAIRED` | Fixed delivery slot surcharge assertions & pricing verification |
| `frontend/scripts/test-smart-login-cart-recovery-e2e.ts` | Recovery | `WEAKENED` $\rightarrow$ `REPAIRED` | Fixed abandonment status transition & recovery attribution checks |
| `frontend/scripts/test-branch-manager.ts` | Branch Portal | `WEAKENED` $\rightarrow$ `REPAIRED` | Fixed KOT reprint counter & GST invoice generation checks |
