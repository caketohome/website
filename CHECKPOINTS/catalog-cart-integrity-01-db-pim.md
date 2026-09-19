# CHECKPOINT 01 — CATALOG & PIM DATA INTEGRITY INVESTIGATION

**Timestamp**: 2026-09-18T10:08:00+05:30  
**Phase**: Database & PIM Investigation  
**Status**: INVESTIGATION COMPLETE — ROOT CAUSE IDENTIFIED  
**Branch**: `task/dev`  
**Git Working Tree**: Head `3081621` (preserved cleanly)

---

## 1. Product Record Details (Database: PostgreSQL)

### Product: Butter Croissant
- **Table**: `product`
- **ID**: `prod_01KXYMAJKNS8AGWCN5S1WEGKSD`
- **Title**: `Butter Croissant`
- **Handle**: `butter-croissant`
- **Category**: `Pastries` (`pcat_01KXYMAJ2W3HTY68D0N4S4DTF3` / `cat_pastries`)
- **Status**: `published`
- **Database Column `weight`**: `null`
- **Metadata Keys**:
  `['mrp', 'price', 'weight', 'category', 'occasion', 'occasion_ids', 'category_slug', 'selling_price', 'weight_prices', 'price_updated_at', 'primary_category_id', 'price_correction_source']`
- **Metadata `price`**: `149`
- **Metadata `selling_price`**: `149`
- **Metadata `mrp`**: `199`
- **Metadata `weight`**: `"1 pc"` (INVALID SEED)
- **Metadata `weight_prices`**:
  ```json
  [
    {
      "id": "wp_croissant_1",
      "mrp": 199,
      "is_enabled": true,
      "weight_name": "1 pc",
      "selling_price": 149,
      "normalized_grams": 100
    }
  ]
  ```
- **Metadata `price_correction_source`**: `"canonical_inr_seed_fix"`

### Product: Chocolate Fudge Cupcake
- **ID**: `prod_01KXYMAJKNDZ4T2YVA7K144XP5`
- **Title**: `Chocolate Fudge Cupcake`
- **Handle**: `chocolate-fudge-cupcake`
- **Category**: `Cupcakes` (`pcat_01KXYMAJ594FW8E5ZNFVQGCZAK`)
- **Status**: `published`
- **Metadata `selling_price`**: `499`
- **Metadata `mrp`**: `599`
- **Metadata `weight`**: `"Box of 6"`
- **Metadata `weight_prices`**:
  ```json
  [
    {
      "id": "wp_cupcake_choc_6",
      "mrp": 599,
      "is_enabled": true,
      "weight_name": "Box of 6",
      "selling_price": 499,
      "normalized_grams": 300
    }
  ]
  ```

---

## 2. PIM Architecture & Config Record

- **PIM Model**:
  Stored in `product.metadata.pim_config` and managed via `frontend/src/components/dashboard/admin/pim-editor-modal.tsx`.
- **Config Fields**:
  `show_weight`, `required_weight`, `show_shape`, `required_shape`, `show_flavour`, `required_flavour`, `show_filling`, `required_filling`, `show_cream`, `required_cream`, `show_dietary`, `required_dietary`, `show_photo_cake`, `show_cake_message`, `min_prep_hours`, `same_day_allowed`, `express_allowed`, `midnight_allowed`, `scheduled_allowed`, `max_delivery_distance_km`.
- **For Butter Croissant**:
  `pim_config` is currently `undefined` in `product.metadata`, which causes the frontend to default `show_weight: true` and `required_weight: true`.
  Because `weight_prices` was seeded with `[{"weight_name": "1 pc"}]`, the UI rendered "SELECT SIZE & WEIGHT *" with "1 pc".

---

## 3. Product Variant Records (`product_variant` Table)

1. **Butter Croissant**:
   - `id`: `variant_01KXYMAN3V20SZ3SR5HX46Q9NC`
   - `product_id`: `prod_01KXYMAJKNS8AGWCN5S1WEGKSD`
   - `title`: `Butter Croissant`
   - `sku`: `BUTTER-CROISSANT`
   - `weight`: `null`
   - **Variant Count**: 1 (Single standard item, NOT multi-weight variant!)

2. **Vanilla Bean Cupcake**:
   - `id`: `variant_01KXYMAN3Y6K3Z7TH1ZRFEY97N`
   - `product_id`: `prod_01KXYMAJKNV48P1B9CM7C022YM`
   - `title`: `Vanilla Bean Cupcake - Box of 6`
   - `sku`: `VANILLA-CUPCAKE-6`
   - **Variant Count**: 1

3. **Chocolate Fudge Cupcake**:
   - `id`: `variant_01KXYMAN40MW6VZV49HJA15CXE`
   - `product_id`: `prod_01KXYMAJKNDZ4T2YVA7K144XP5`
   - `title`: `Chocolate Fudge Cupcake - Box of 6`
   - `sku`: `CHOC-FUDGE-CUPCAKE-6`
   - **Variant Count**: 1

---

## 4. SKU & Pricing Records

- **Medusa `price` Table**:
  - Contains prices in `usd` ($3.99) and `eur` (€2.99) for `variant_01KXYMAN3V20SZ3SR5HX46Q9NC`.
  - Did NOT contain `inr` prices.
- **PostgreSQL `product.metadata`**:
  - Contains authoritative INR prices: `price: 149`, `selling_price: 149`, `mrp: 199`.

---

## 5. Root Cause of "1 pc"

1. **Initial Problem**:
   Certain products had zero/missing INR prices in `price` set, which caused `ApiEngine.addToCart` to fail with:
   `Price for "Chocolate Fudge Cupcake" must be greater than zero.`
2. **The Erroneous Seed**:
   A script `scratch/seed_fix_zero_price_products.js` was executed to seed prices in `product.metadata`.
   For Butter Croissant (`prod_01KXYMAJKNS8AGWCN5S1WEGKSD`), the script erroneously set:
   ```javascript
   weight: '1 pc',
   weight_prices: [
     {
       id: 'wp_croissant_1',
       weight_name: '1 pc',
       selling_price: 149,
       mrp: 199,
       normalized_grams: 100,
       is_enabled: true
     }
   ]
   ```
3. **Data Flow to UI**:
   - `ProductRepository.mapRowToDomain` read `meta.weight_prices` and exposed it on `ProductDomain.weight_prices`.
   - `page.tsx` read `fetched.weight_prices` and passed it to `ProductDetailClient`.
   - `ProductDetailClient` mapped `weightPrices` into `weightsList`.
   - `PdpVariantSelector` checked `showWeight && weights.length > 0` and rendered:
     ```
     SELECT SIZE & WEIGHT *
     1 pc
     ₹149
     ```
4. **Conclusion**:
   The "1 pc" variant is **an invalid seeded record** in `product.metadata.weight_prices` and `product.metadata.weight`. Butter Croissant does **not** have weight variations. It is a single bakery unit sold at ₹149.

---

## 6. Root Cause of Zero-Price Validation

In `ApiEngine.addToCart` (`frontend/src/lib/api-engine.ts` lines 18436-18491):
When an item was added without a resolved price from `weightPrices` or `canonicalProduct.price` / `canonicalProduct.selling_price`:
If `product.metadata.selling_price` was null or missing (as was the case before INR prices were populated), `unitPrice` resolved to `0`, triggering:
`Unable to add item to cart: Price for "<Title>" must be greater than zero.`
With `selling_price: 499` populated for Chocolate Fudge Cupcake and `selling_price: 149` for Butter Croissant, the unit price is correctly resolved.

---

## 7. Hybrid Cart Storage Audit

- **Audit Findings**:
  - `actions/carts.ts`: Uses PostgreSQL `CartRepository` (`cart` and `cart_line_item` tables) and memory store. Cart identity is maintained exclusively via HTTP cookies `_cth_cart_id` and `_medusa_cart_id`.
  - There is **no** fallback to `localStorage` or `sessionStorage` in `actions/carts.ts` or `data/carts.ts`.
  - Two marketing/engagement components (`exit-intent-popup.tsx` line 25 and `engagement-provider.tsx` line 211) contained legacy reads from `localStorage.getItem("medusa_cart_items") || localStorage.getItem("_cth_cart_items")`. These must be cleaned up to prevent stale cart count inference.
  - Legitimate session cookies (`_cth_cart_id`, `_medusa_cart_id`, `_cth_customer_uid`, `_cth_jwt`, `delivery_pincode`, `delivery_location`) are preserved.

---

## 8. Exact Files Responsible

1. `scratch/seed_fix_zero_price_products.js` (Script that injected `weight: "1 pc"` and `weight_prices: [{"weight_name": "1 pc"}]` into DB)
2. PostgreSQL `product` table: row `prod_01KXYMAJKNS8AGWCN5S1WEGKSD` metadata
3. `frontend/src/app/(store)/products/[id]/page.tsx` (Has fallback `variants: [{ title: "500g", sku: "...-500G" }]` instead of reading real `product_variant` from DB)
4. `frontend/src/components/store/shop/product-detail-client.tsx` (Assumes all products must show weight selector if `activePimConfig.show_weight` is default true)
5. `frontend/src/components/store/pdp/pdp-variant-selector.tsx` (Blindly renders "Select Size & Weight *" when weights are present, even for products with no variant choices)
6. `frontend/src/components/store/marketing/exit-intent-popup.tsx` (Reads stale `medusa_cart_items` from `localStorage`)
7. `frontend/src/components/store/engagement/engagement-provider.tsx` (Reads stale `medusa_cart_items` from `localStorage`)

---

## 9. Next Step

Proceed to Checkpoint 02: Cart Storage Audit & Removal of Hybrid Cart Persistence.
