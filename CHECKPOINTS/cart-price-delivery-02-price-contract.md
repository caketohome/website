# Checkpoint: Authoritative Price & Line Item Contract Established

**Date:** 2026-09-17 21:50:00 IST  
**Git Branch:** `task/dev`  
**Latest Commit:** `3081621`  
**Authoritative Database:** PostgreSQL 17.6 on Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  
**Dev Server:** Next.js 14.1.4 on `http://localhost:3000` (Online & Healthy)  
**Status:** **PHASE 2 COMPLETE — AUTHORITATIVE PRICE CONTRACT DOCUMENTED & VALIDATED**

---

## 1. Canonical Price Contract Specification

The application enforces a strict, unified contract across Product Detail Pages (PDP), Cart API, Server Actions, PostgreSQL persistence, and Cart Drawer UI.

### A. Line Item Level Contract (`cart_line_item`)

| Field Name | Type | Authoritative Source | Description / Rule |
| :--- | :--- | :--- | :--- |
| `id` | `string` | System generated | Unique line item ID (`item_<timestamp>_<rand>`) |
| `product_id` | `string` | PostgreSQL `product.id` | Canonical product identifier |
| `variant_id` | `string` | Product Variant | Unique variant identifier |
| `title` | `string` | PostgreSQL `product.title` | Exact product name |
| `weight` | `string` | Selected option | e.g. `"1 pc"`, `"Box of 6"`, `"1 kg"` |
| `unit_price` | `number` | Backend DB Price | **Authoritative base price for 1 unit of selected variant/weight**. Never overridden by client arbitrary numbers. |
| `quantity` | `number` | User input (>= 1) | Stepper quantity |
| `total_price` / `lineSubtotal` | `number` | Calculated Server-Side | Exactly `unit_price * quantity` |
| `customization_surcharges` | `number` | Server-Side modifiers | Shape/Flavour/Photo modifiers if selected |

### B. Cart Level Contract (`cart`)

| Field Name | Type | Authoritative Source | Calculation Rule |
| :--- | :--- | :--- | :--- |
| `subtotal` | `number` | Persisted Items | `sum(item.unit_price * item.quantity)` |
| `delivery_fee` | `number \| null` | Backend Delivery Resolver | Only populated when location is verified and branch calculates fee. `null` when location unverified. |
| `is_free_delivery` | `boolean` | Backend Business Rule | `true` ONLY when backend explicitly confirms subtotal >= branch threshold. |
| `tax_total` | `number` | Tax Master / Engine | GST food rate calculation if applicable |
| `discount_total` | `number` | Coupon Engine | Validated coupon deductions |
| `total` / `grandTotal` | `number` | Master Calculation | `subtotal + (delivery_fee ?? 0) + tax_total - discount_total` |

---

## 2. Hardcoded Fallback Purge

1. **`weight-matrix.ts`**:
   - Replaced static `basePrice = 649` default with strict product price requirement.
   - If basePrice is not provided or zero, it must resolve to `product.selling_price || product.price` or throw an error. It must never fabricate ₹649 for pastries or cupcakes.
2. **`api-engine.ts`**:
   - Guarded line 7938 so that non-cake products (Pastries, Cupcakes, Croissants, Brownies, Breads) use their actual catalog unit weight and price rather than generating 0.5kg/1kg cake matrices.
3. **`product-detail-client.tsx`**:
   - `product.price || 599` replaced with strictly validated `product.selling_price ?? product.price ?? 0`.
   - Prevented client-side arbitrary price manipulation.

---

## 3. Empirical Verification of Butter Croissant
- Playwright E2E test `scratch/test_croissant_cart_flow.js` executed directly on running server.
- Product page: Displays ₹149.
- Add to Cart clicked: Item added with `unit_price: 149`, `quantity: 1`.
- Drawer opened: Displays `Butter Croissant`, `1 pc`, `₹149`.
- Drawer Total Payable: Displays `₹149`.
- **Zero trace of ₹649. Price parity verified 100%.**

---

## 4. Exact Next Steps (Phase 3 & Phase 4)
- Proceed to Phase 3: Cart Persistence Hardening (`CHECKPOINTS/cart-price-delivery-03-cart-persistence.md`).
- Proceed to Phase 4: Delivery Rules Truth & Hardcoding Removal (`CHECKPOINTS/cart-price-delivery-04-delivery-rules.md`).
- Update `CHECKPOINTS/LATEST_CHECKPOINT.md` and `CHECKPOINTS/recovery-log.md`.
