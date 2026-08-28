# Forensic Root Cause Audit: Product Option Source-of-Truth & PIM Isolation

## 1. Executive Summary

A critical data-integrity defect was discovered where the customer storefront displayed product options (e.g. Shapes: *Round, Heart +₹150, Square +₹200, 2-Tier Designer +₹2500*; Flavor: *Belgian Dark Chocolate*; Filling: *Chocolate Ganache +₹100*; Cream: *Fresh Cream*) on products such as **Classic Red Velvet Cream Cheese Cake** (`prod_2` / `classic-red-velvet-cake`), even when the Super Admin PIM indicated **"0 of 5 flavors selected"** and **"0 of 4 shapes selected"**.

This forensic audit identifies the exact layers, files, APIs, and fallback chains responsible for option contamination, and outlines the single-source-of-truth architecture where **PIM Product Configuration is the ONLY customer option authority**.

---

## 2. End-to-End Option Flow Tracing Matrix

| Pipeline Layer | Component / File | Function / Endpoint | Input | Output / Behavior | Source of Truth | Defect / Failure Mode |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Customer Storefront UI** | `frontend/src/components/store/shop/product-detail-client.tsx` | `ProductDetailClient` | `product.id`, `storefrontOptions` | Renders `<select>` and button grids for shapes, flavours, fillings, creams | `apiClient.getStorefrontProductOptions(product.id)` | Renders options whenever array length > 0, trusting API response |
| **Storefront SSR Page** | `frontend/src/app/(store)/products/[id]/page.tsx` | `ProductDetailPage` | `params.id` | Loads product metadata and passes `pimConfig` to client | `catalog.ts` (`getProductById` / `getProductBySlug`) | Passes raw `pim_config` from product record |
| **Frontend API Client** | `frontend/src/lib/api-client.ts` | `getStorefrontProductOptions` | `productId: string` | Calls `GET /api/v1/store/catalog/products/:id/options` | REST API | None (transparent client proxy) |
| **Next.js API Gateway** | `frontend/src/app/api/v1/[...path]/route.ts` | `GET store/catalog/products/:id/options` | `path`, `productId` | Returns JSON from `ApiEngine.getStorefrontProductOptions` | `ApiEngine` | Route handler correctly delegates to `ApiEngine` |
| **Admin Mappings GET API** | `frontend/src/app/api/v1/[...path]/route.ts` | `GET admin/catalog/products/:id/flavor-mappings` | `productId` | Returned `ApiEngine.listVariantOptions("flavour")` | `DEFAULT_VARIANT_OPTIONS` | **CRITICAL DEFECT**: Returned all global masters instead of product-specific mappings! |
| **Admin Mappings POST API** | `frontend/src/app/api/v1/[...path]/route.ts` | `POST admin/catalog/products/:id/flavor-mappings` | `productId`, `mappings` | **MISSING HANDLER** | None | **CRITICAL DEFECT**: POST requests from PIM were unhandled, dropping save mutations! |
| **Core API Engine** | `frontend/src/lib/api-engine.ts` | `ApiEngine.getStorefrontProductOptions` | `productId` | `{ flavors, shapes, fillings, creams, weights, ... }` | `memoryStore.products` | **CRITICAL DEFECT**: When `customFlavors` was empty (0 selected in PIM), defaulted to `product.flavour` ("Belgian Dark Chocolate") and `shape_round` ("Round")! |
| **PIM Editor Modal** | `frontend/src/components/dashboard/admin/pim-editor-modal.tsx` | `PimEditorModal` / `handleSubmit` | Admin form inputs | Sends mappings to `saveProductFlavorMappings` & `saveProductShapeMappings` | UI state (`selectedFlavours`, `selectedShapes`) | Submissions dropped due to missing backend POST route handlers |
| **Database Persistence** | `frontend/src/lib/db-persistence.ts` & PostgreSQL | `persistProductToDb` / `hydrateStoreFromDatabase` | Product record | PostgreSQL `public.product` table | PostgreSQL | Mappings were not serialized into product entity columns |

---

## 3. Forensic Identification of Visible Customer Options

### Who Created Each Visible Option?

1. **Classic Round (₹0)**:
   - *Origin*: Introduced in `frontend/src/lib/api-engine.ts` (`DEFAULT_VARIANT_OPTIONS` `opt_s_01` & `ApiEngine.getStorefrontProductOptions` fallback line 13709).
   - *Status*: Hardcoded fallback.

2. **Heart (+₹150)**:
   - *Origin*: Introduced in `frontend/src/lib/api-engine.ts` (`DEFAULT_VARIANT_OPTIONS` `opt_s_02`).
   - *Status*: Global master option, leaked onto product.

3. **Square (+₹200)**:
   - *Origin*: Introduced in `frontend/src/lib/api-engine.ts` (`DEFAULT_VARIANT_OPTIONS` `opt_s_03`).
   - *Status*: Global master option, leaked onto product.

4. **2-Tier Designer (+₹2500)**:
   - *Origin*: Introduced in `frontend/src/lib/api-engine.ts` (`DEFAULT_VARIANT_OPTIONS` `opt_s_04`).
   - *Status*: Global master option, leaked onto product.

5. **Belgian Dark Chocolate (₹0)**:
   - *Origin*: Introduced in `frontend/src/lib/api-engine.ts` (`DEFAULT_VARIANT_OPTIONS` `opt_f_01` & fallback to `product.flavour`).
   - *Status*: Leaked onto Red Velvet cake because `product.flavour` was populated and 0 selected in PIM triggered fallback.

6. **Chocolate Ganache (+₹100)**:
   - *Origin*: Introduced in `frontend/src/lib/api-engine.ts` (`DEFAULT_VARIANT_OPTIONS` `opt_fil_01`).
   - *Status*: Global master filling option.

7. **Fresh Cream (₹0)**:
   - *Origin*: Introduced in `frontend/src/lib/api-engine.ts` (`DEFAULT_VARIANT_OPTIONS` `opt_c_01`).
   - *Status*: Global master cream option.

---

## 4. Comparison: Customer Storefront vs PIM Source-of-Truth

For **Classic Red Velvet Cream Cheese Cake** (`prod_2` / `classic-red-velvet-cake`):

| Attribute | Real PIM State | Current Storefront State | Alignment |
| :--- | :--- | :--- | :--- |
| **Real Product ID** | `prod_2` | `prod_2` | ✅ Matches |
| **Enable Flavor Selection** | `true` | `true` | ✅ Matches |
| **Enable Shape Selection** | `true` | `true` | ✅ Matches |
| **Selected Flavors** | **0 of 5 selected** (`[]`) | **1 flavor** (*Belgian Dark Chocolate*) | ❌ **PIM ≠ STOREFRONT** |
| **Selected Shapes** | **0 of 4 selected** (`[]`) | **4 shapes** (*Round, Heart, Square, 2-Tier*) | ❌ **PIM ≠ STOREFRONT** |
| **Selected Fillings** | **0 selected** (`[]`) | **1 filling** (*Chocolate Ganache*) | ❌ **PIM ≠ STOREFRONT** |
| **Selected Creams** | **0 selected** (`[]`) | **1 cream** (*Fresh Cream*) | ❌ **PIM ≠ STOREFRONT** |

**Conclusion: PIM ≠ STOREFRONT.** The storefront was obtaining options from silent fallbacks and global master defaults rather than the product-scoped PIM mapping table.

---

## 5. Architectural Root Cause Discovery

Three distinct structural flaws were discovered:

### Root Cause 1: Missing Route Handlers for Product Option Mappings
`PimEditorModal` in `frontend/src/components/dashboard/admin/pim-editor-modal.tsx` correctly dispatches:
- `apiClient.saveProductFlavorMappings(targetProdId, selectedFlvObjects)`
- `apiClient.saveProductShapeMappings(targetProdId, selectedShpObjects)`

However, in `frontend/src/app/api/v1/[...path]/route.ts`:
- `GET /admin/catalog/products/[id]/flavor-mappings` returned all global flavor masters (`ApiEngine.listVariantOptions("flavour")`).
- `POST /admin/catalog/products/[id]/flavor-mappings` was completely unhandled (404 / no-op).
- `GET /admin/catalog/products/[id]/shape-mappings` returned all global shape masters (`ApiEngine.listVariantOptions("shape")`).
- `POST /admin/catalog/products/[id]/shape-mappings` was completely unhandled (404 / no-op).

### Root Cause 2: Fallback to Product Attributes on Zero Selections
In `ApiEngine.getStorefrontProductOptions` (`frontend/src/lib/api-engine.ts` lines 13702-13710):
```typescript
const flavors = pimConfig.show_flavour === false
  ? []
  : customFlavors || (product?.flavour ? [{ id: "flv_primary", name: product.flavour, display_name: product.flavour, price_modifier: 0 }] : []);

const shapes = pimConfig.show_shape === false
  ? []
  : customShapes || (pimConfig.show_shape ? [{ id: "shape_round", name: "Round", display_name: "Round", price_modifier: 0 }] : []);
```
When `customFlavors` was empty (`[]`), the expression `customFlavors || fallback` evaluated the right-hand fallback! Because `product.flavour` existed, it constructed a synthetic flavor option. When `0 of 5 flavors` were selected in PIM, `customFlavors` was `[]`, which silently triggered the fallback instead of returning an empty array.

### Root Cause 3: Conflating "Available Master Options" with "Product-Selected Options"
The master catalog tables (`DEFAULT_VARIANT_OPTIONS`) define the universe of available options in the bakery. Super Admin selects a subset for a specific product. The customer storefront must **ONLY** receive the product-selected subset. Zero selected must yield zero customer options.

---

## 6. Target Single-Source-of-Truth Architecture

```
                       SUPER ADMIN (PIM UI)
                                 │
                     [Selects 0, 1, or N Options]
                                 │
                                 ▼
      POST /api/v1/admin/catalog/products/:id/flavor-mappings
      POST /api/v1/admin/catalog/products/:id/shape-mappings
                                 │
                                 ▼
                         ApiEngine Persistence
              (Stores product.flavors & product.shapes)
                                 │
                                 ▼
                         PostgreSQL Database
                                 │
                                 ▼
        GET /api/v1/store/catalog/products/:id/options
           (Returns ONLY explicitly mapped options)
                                 │
                                 ▼
                        Customer Storefront
                   (Renders ONLY mapped options;
                    if 0 selected -> hides selector)
                                 │
                                 ▼
                          Cart & Checkout
           (Server validates options belong to product)
                                 │
                                 ▼
                          Order Snapshot
```

---

## 7. Mandatory Semantic Rules & Invariants

1. **Zero Selected = Zero Options**: When PIM has 0 selected flavors/shapes, API must return `flavors: []`, `shapes: []`, and storefront must render NO flavor/shape selector.
2. **One Selected = Exactly One Option**: When PIM selects only "Belgian Dark Chocolate", API returns `[Belgian Dark Chocolate]`.
3. **Disabled Toggle = Selector Hidden**: When PIM toggles `show_flavour: false` or `show_shape: false`, the selector is completely hidden, and backend rejects flavor/shape submissions.
4. **Product-Scoped Isolation**: Product A's options never leak onto Product B.
5. **No Fake Fallbacks**: Zero fallback to `Celebration Cake`, `product.flavour`, or generic shapes.
6. **Price Recalculation**: Surcharges (+₹150, +₹200) come exclusively from PIM-mapped `price_modifier` / `price_override` and are recalculated server-side during checkout.
