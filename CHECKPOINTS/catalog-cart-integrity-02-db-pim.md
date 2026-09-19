# CHECKPOINT 02 — DATABASE & PIM INVESTIGATION (CANONICAL)

**Date/Time**: 2026-09-18T10:22:00+05:30  
**Phase**: Database & PIM Investigation  
**Status**: INVESTIGATION COMPLETE — EXACT ROOT CAUSE DOCUMENTED  
**Branch**: `task/dev` (Head commit `3081621`)  

---

## 1. Database Inspection Findings (PostgreSQL 17.6 on Supabase)

### A. Table `product` — Row `prod_01KXYMAJKNS8AGWCN5S1WEGKSD` (Butter Croissant)
- **Title**: `Butter Croissant`
- **Handle**: `butter-croissant`
- **Category ID**: `pcat_01KXYMAJ2W3HTY68D0N4S4DTF3` (`cat_pastries`)
- **Status**: `published`
- **Native Column `weight`**: `null`
- **Metadata**:
  ```json
  {
    "mrp": 199,
    "price": 149,
    "weight": "1 pc",
    "category": "Pastries",
    "occasion": "Everyday Celebration",
    "occasion_ids": ["occ_01KXYMAJ2N6Q27K9W7F3389D33"],
    "category_slug": "pastries",
    "selling_price": 149,
    "weight_prices": [
      {
        "id": "wp_croissant_1",
        "mrp": 199,
        "is_enabled": true,
        "weight_name": "1 pc",
        "selling_price": 149,
        "normalized_grams": 100
      }
    ],
    "price_updated_at": "2026-09-17T14:48:37.491Z",
    "primary_category_id": "pcat_01KXYMAJ2W3HTY68D0N4S4DTF3",
    "price_correction_source": "canonical_inr_seed_fix"
  }
  ```

### B. Table `product_variant` for Butter Croissant
- Query: `SELECT id, product_id, title, sku, weight FROM product_variant WHERE product_id = 'prod_01KXYMAJKNS8AGWCN5S1WEGKSD'`
- Results:
  - `id`: `variant_01KXYMAN3V20SZ3SR5HX46Q9NC`
  - `product_id`: `prod_01KXYMAJKNS8AGWCN5S1WEGKSD`
  - `title`: `Butter Croissant`
  - `sku`: `BUTTER-CROISSANT`
  - `weight`: `null`
- **Variant Count**: Exactly 1. Butter Croissant does **not** have variations in Medusa DB.

### C. Product `Chocolate Fudge Cupcake` (`prod_01KXYMAJKNDZ4T2YVA7K144XP5`)
- Native Column `weight`: `null`
- Metadata `selling_price`: `499`
- Metadata `weight`: `"Box of 6"`
- Metadata `weight_prices`:
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
- Variant: `variant_01KXYMAN40MW6VZV49HJA15CXE`, `title: Chocolate Fudge Cupcake - Box of 6`, `sku: CHOC-FUDGE-CUPCAKE-6`.

---

## 2. Root Cause Analysis: The Phantom "1 pc"

1. **Origin in Database**:
   - In `scratch/seed_fix_zero_price_products.js`, a repair script previously updated `product.metadata` to ensure products without Medusa INR pricing had non-zero prices.
   - For Butter Croissant, it erroneously assigned:
     `weight: "1 pc"`
     `weight_prices: [{ id: "wp_croissant_1", weight_name: "1 pc", selling_price: 149, mrp: 199, normalized_grams: 100, is_enabled: true }]`
2. **Propagation to Frontend**:
   - `ProductRepository.mapRowToDomain` parses `meta.weight_prices` and populates `product.weight_prices`.
   - `frontend/src/app/(store)/products/[id]/page.tsx` passes `product.weight_prices` to `ProductDetailClient`.
   - `ProductDetailClient` translates `weight_prices` into `weightsList = ["1 pc"]`.
   - `PdpVariantSelector` checks `showWeight && weights.length > 0`. Because `pim_config` defaults `show_weight: true`, it renders:
     ```
     SELECT SIZE & WEIGHT *
     [ 1 pc ]
     ₹149
     ```
3. **Core Conclusion**:
   - CakeToHome business logic has confirmed: **There is NO "1 pc" variation**. Butter Croissant is a standalone item with 0 weight variations.
   - Remediation requires:
     a. Cleaning `weight_prices` and `weight: "1 pc"` from `product.metadata` for Butter Croissant.
     b. Configuring `pim_config: { show_weight: false, required_weight: false }` for pastry/cupcake items that do not have multi-size variations.
     c. Hardening PDP so it does not render the "SELECT SIZE & WEIGHT *" selector when `show_weight === false` or `weight_prices.length === 0`.

---

## 3. Next Phase
Proceed directly to **CHECKPOINT 03: Cart Storage Audit & Removal of Hybrid Cart Persistence** (`CHECKPOINTS/catalog-cart-integrity-03-cart-storage.md`).
