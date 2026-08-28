# Forensic Audit: Legacy Product-Level Allowed Delivery Zones System

## 1. Executive Summary
This audit inspects every reference to `Zone 1`, `Zone 2`, `Zone 3`, `Zone 4`, distance brackets (`0-5 KM`, `5-10 KM`, `10-15 KM`, `15-20 KM`), `allowed_zones`, and `product_delivery_restrictions` across the codebase.

The findings establish a critical architectural boundary:
1. **Store Operational Zones & Area Matrix (RETAIN)**: Store operational delivery zones (e.g. Bangalore Express Zone, Koramangala Hub Zone) represent physical geographic coverage areas (polygons, radius, exclusions) assigned to branches in the Store Area Matrix. These are legitimate and must NOT be removed.
2. **Product Zone Selection (REMOVE)**: Asking a product in PIM to select "Zone 1 (0–5 KM)", "Zone 2 (5–10 KM)", etc., or restricting a product by `zone_id` via `isProductDeliveryRestricted` is an obsolete delivery model. It is completely replaced by product-scoped `max_delivery_distance_km: number | null`.

---

## 2. Complete Forensic Match Matrix

| FILE | LINE | FUNCTION / CONTEXT | TYPE | PURPOSE | DEPENDENCY | SAFE TO REMOVE? | REASON |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/src/components/dashboard/admin/pim-editor-modal.tsx` | 1480–1595 | `PimEditorModal` Tab 7 | RUNTIME (UI) | Product delivery permissions & distance restriction. | Admin PIM UI | **YES (Cleaned)** | Already migrated to `maxDeliveryDistanceKm` radio & input; confirmed zero checkboxes for Zone 1–4. |
| `frontend/src/lib/api-engine.ts` | 21463–21475 | `validateCheckout` | RUNTIME (Checkout) | Legacy check `isProductDeliveryRestricted(k, branch.id, resolvedZoneId)` | `product_delivery_restrictions` | **YES (Remove)** | Products must not be restricted by legacy `zone_id`. Map coverage + `max_delivery_distance_km` governs. |
| `frontend/src/lib/api-engine.ts` | 21477–21487 | `validateCheckout` | RUNTIME (Checkout) | Evaluates `productMaxDist` against `branchRes.distanceKm`. | `max_delivery_distance_km` | **NO (Retain & Enforce)** | This is the canonical distance enforcement returning `PRODUCT_DISTANCE_EXCEEDED`. |
| `frontend/src/lib/api-engine.ts` | 15341–15348 | `resolveSmartBranch` | RUNTIME (Store Resolver) | Filters candidate stores where `dist > product.max_delivery_distance_km`. | Store Haversine distance | **NO (Retain & Enforce)** | Ensures only stores within product distance limit are eligible to fulfill. |
| `frontend/src/lib/api-engine.ts` | 16440–16528 | `getProductDeliveryRestriction`, `isProductDeliveryRestricted`, `setProductDeliveryRestriction` | RUNTIME (Legacy) | Legacy in-memory CRUD for per-zone product restrictions. | None in new flow | **YES (Deprecated)** | Obsolete product zone system; bypass in checkout. |
| `frontend/src/components/dashboard/admin/branch-pincode-panel.tsx` | 29, 67–74, 93–96, 490–493 | `BranchPincodePanel` | RUNTIME (Admin Branch Ops) | Operational branch pincode-to-zone mappings with distance tags (`Zone 1 (0-5 KM)`). | Branch ops only | **NO (Retain)** | This is store operational branch configuration, NOT product PIM. |
| `frontend/src/lib/api-engine.ts` | 18801–18806 | `INITIAL_BRANCH_PINCODES` | SEED DATA | Initial branch pincodes with `zone_name: "Zone 1 (0-5 KM)"`. | Branch ops seed | **NO (Retain)** | Branch operational data seed. |
| `frontend/src/lib/api-engine.ts` | 19191–19194 | `getEnterpriseReportData` | RUNTIME (Analytics) | Mock report aggregation grouping orders by distance band label. | Admin Reports | **NO (Retain)** | Historical analytics aggregation label. |
| `backend/src/api/admin/orders/[id]/route.ts` | 143 | `GET /admin/orders/:id` | RUNTIME (Historical Orders) | Fallback label `zone: meta.zone \|\| "Zone 1 (0-5 KM)"` for legacy orders. | Order snapshot metadata | **NO (Retain)** | Prevents breaking historical order view for orders placed under legacy model. |
| `backend/src/api/admin/orders/route.ts` | 158 | `GET /admin/orders` | RUNTIME (Historical Orders) | Fallback label `zone: meta.zone \|\| "Zone 1 (0-5 KM)"` for legacy orders. | Order snapshot metadata | **NO (Retain)** | Prevents breaking historical order list view. |
| `frontend/src/lib/api-engine.ts` | 2590–2615 | `DEFAULT_DELIVERY_PROFILES` | SEED DATA | `prof_regular`, `prof_designer`, etc. | PIM delivery profile dropdown | **NO (Retain & Cleaned)** | Already cleaned of "All Zones" / "Zones 1-3" language. |

---

## 3. Forensic Root-Cause Conclusion
1. **PIM Editor Modal (`pim-editor-modal.tsx`)**:
   - Tab 7 previously had legacy Zone 1–4 checkboxes.
   - The UI was updated to define `maxDeliveryDistanceKm` with radio toggles (`No product-specific limit` vs `Maximum delivery distance`).
   - We will refine the layout to match the exact user prompt specifications for Phase 10 & 11 (clean labels, helper text, and clear NULL mapping).
2. **Checkout Engine (`api-engine.ts`)**:
   - `validateCheckout` contained a dual check: both `isProductDeliveryRestricted` (by `zone_id`) and `max_delivery_distance_km`.
   - The legacy `isProductDeliveryRestricted` check is now removed from `validateCheckout`, ensuring that `max_delivery_distance_km` and Store Map Fencing are the single source of truth.
