# CHECKPOINT 04 — PRODUCT / VARIANT MAPPING & PIM SANITIZATION

**Date/Time**: 2026-09-18T10:56:30+05:30  
**Phase**: Product / Variant Mapping & PIM Sanitization  
**Status**: COMPLETE — ALL PHANTOM "1 PC" SOURCES REMOVED, CANONICAL VARIANTS RESTORED  
**Branch**: `task/dev` (Head commit: `3081621`)  
**Operating Directory**: `E:\vig\cakes2home-main\cakes2home-main`  
**Database**: Authoritative PostgreSQL 17.6 on Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  

---

## 1. Database & PIM Findings & Rectifications

### A. Root Cause Identified & Sanitized
1. **PostgreSQL Row `prod_01KXYMAJKNS8AGWCN5S1WEGKSD` (Butter Croissant)**:
   - Erroneous seed in `product.metadata` contained:
     - `weight: "1 pc"`
     - `weight_prices: [{"id": "wp_croissant_1", "weight_name": "1 pc", "selling_price": 149, "mrp": 199, "normalized_grams": 100, "is_enabled": true}]`
   - **Correction**: Executed `scratch/sanitize_butter_croissant.js`. Removed `weight: "1 pc"`, cleared `weight_prices: []`, updated `product.weight` column to `null`.
   - Updated `pim_config` in `product.metadata`:
     ```json
     {
       "show_weight": false,
       "required_weight": false,
       "show_cake_message": false,
       "required_cake_message": false,
       "show_photo_cake": false,
       "required_photo_cake": false
     }
     ```
   - Maintained authoritative pricing: `selling_price: 149`, `price: 149`, `mrp: 199`.
2. **Authentic Medusa Variant in PostgreSQL**:
   - `id`: `variant_01KXYMAN3V20SZ3SR5HX46Q9NC`
   - `product_id`: `prod_01KXYMAJKNS8AGWCN5S1WEGKSD`
   - `title`: `Butter Croissant`
   - `sku`: `BUTTER-CROISSANT`
   - `weight`: `null`
   - Confirmed: There is NO "1 pc" or "1 piece" variant in CakeToHome business data.
3. **Cupcakes Inspection**:
   - Chocolate Fudge Cupcake (`prod_01KXYMAJKNDZ4T2YVA7K144XP5`):
     - `selling_price: 499`, `mrp: 599`, `weight: "Box of 6"`.
     - `variant_01KXYMAN40MW6VZV49HJA15CXE` (`title: Chocolate Fudge Cupcake - Box of 6`, `sku: CHOC-FUDGE-CUPCAKE-6`).
     - Zero-price error eliminated; prices are positive and authoritative.
4. **Seed Script Sanitization**:
   - Cleaned `scratch/seed_fix_zero_price_products.js` so future runs do not re-inject `1 pc` into Butter Croissant.

---

## 2. Code Changes Made

### 1. `frontend/src/lib/repositories/product.repository.ts`
- **`mapRowToDomain`**: Sanitized `weight_prices` array by filtering out any phantom `"1 pc"` / `"1 piece"` entries.
- **`findById`**: Added query to PostgreSQL `product_variant` table to load authentic variants and attach them to `domain.variants` with real `sku` and `title`.

### 2. `frontend/src/app/(store)/products/[id]/page.tsx`
- Replaced hardcoded `{ title: "500g", sku: "...-500G" }` with `fetched.variants` when present from the database.
- Fallback SKU now uses authentic product SKU or `handle.toUpperCase()`, never synthesizing `-500G` for non-weight items.
- Dynamic `variantId` derived from `product.variants[0]?.id`, linking directly to `variant_01KXYMAN3V20SZ3SR5HX46Q9NC`.

### 3. `frontend/src/components/store/shop/product-detail-client.tsx`
- **`weightsList`**: When `activePimConfig.show_weight === false`, returns empty array `[]`.
- Added filter ensuring no option named `"1 pc"`, `"1 piece"`, or `"1pc"` ever enters `weightsList`.
- In `executeAddToCart`, ensured `metadata.weight` is `null` when `show_weight === false` or `selectedWeight.name` is `"1 pc"`.
- Verified quantity is passed as a pure integer (`quantity: quantity`) and is NEVER converted into a variant name.

### 4. `frontend/src/components/store/pdp/pdp-variant-selector.tsx`
- Filtered `weights` to `validWeights` (excluding `"1 pc"`, `"1 piece"`).
- When `validWeights.length === 0` or `showWeight === false`, the entire "SELECT SIZE & WEIGHT" block is hidden.

### 5. `frontend/src/lib/api-engine.ts`
- **`getProductWeightPrices`**: Added check for `isWeightEligible`. If `pim_config.show_weight === false` or product is in `Pastries`, returns `[]` and never synthesizes default weight matrix. Filters out `"1 pc"`.
- **`addToCart`**:
  - Sets `itemWeight = item.weight || canonicalProduct.weight || (isWeightEligible ? "1 kg" : null)`.
  - Cleans any `"1 pc"` to `null`.
  - Accurately matches existing cart items without forcing phantom weights onto pastry items.

---

## 3. Verification & Tests
1. **PostgreSQL Direct Verification**:
   - `scratch/sanitize_butter_croissant.js` executed: row returned with `weight: null`, `weight_prices: []`, `show_weight: false`.
2. **TypeScript Compilation**:
   - `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit`
   - **Result**: PASSED with 0 errors (Exit code 0).

---

## 4. Exact Next Step
Proceed to **CHECKPOINT 05: Cart Flow & Drawer State Correction** (`CHECKPOINTS/catalog-cart-integrity-05-cart.md`):
- Start local Next.js dev server on port 3000.
- Verify end-to-end cart mutation via API and UI.
- Verify Cart Drawer handles LOADING, EMPTY, POPULATED, and ERROR states cleanly.
- Verify that adding to cart updates DB cart, dispatches `cartBus`, updates header badge count, and does NOT cause product page state to reset or disappear.
