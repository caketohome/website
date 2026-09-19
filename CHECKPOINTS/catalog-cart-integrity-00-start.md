# Checkpoint 00: Catalog Data Integrity, Phantom Variant & Cart Storage Audit Start

**Timestamp**: 2026-09-18T09:54:00+05:30  
**Current Branch**: `task/dev` (Head: `308162125fd72ef30c31176ac3312b9e15ff55a2`)  
**Git Integrity**: 129 modified tracked files preserved, 0 tracked files deleted. Zero destructive git operations used.  
**Database**: Authoritative PostgreSQL 17.6 on Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  
**Dev Server**: Running on `http://localhost:3000` (Node.js Next.js 14 App Router)  

---

## 1. Existing Checkpoints Inspected
- `CHECKPOINTS/cart-price-delivery-recovery-START.md`
- `CHECKPOINTS/cart-price-delivery-01-investigation.md`
- `CHECKPOINTS/cart-price-delivery-02-price-contract.md`
- `CHECKPOINTS/cart-price-delivery-03-cart-persistence.md`
- `CHECKPOINTS/cart-price-delivery-04-delivery-rules.md`
- `CHECKPOINTS/cart-price-delivery-05-cart-ui.md`
- `CHECKPOINTS/cart-price-delivery-06-testing.md`
- `CHECKPOINTS/LATEST_CHECKPOINT.md`
- `CHECKPOINTS/recovery-log.md`

---

## 2. Architectural Baseline

### A. Product Page Architecture
- **Server Page**: `frontend/src/app/(store)/products/[id]/page.tsx`
  - Fetches product data via `ProductRepository.findByHandleOrId(slug)` and `ApiEngine.getProduct(slug)`.
  - Also queries accessories, branch fulfillment, reviews, and related products.
  - Passes product and configuration to `ProductDetailClient` (`frontend/src/components/store/shop/product-detail-client.tsx`).
- **Client Component**: `ProductDetailClient` (`frontend/src/components/store/shop/product-detail-client.tsx`)
  - Handles size/weight selection (`selectedWeight`), shapes (`selectedShape`), flavours (`selectedFlavour`), fillings (`selectedFilling`), cake messages, and accessories.
  - Renders `PdpPurchaseActions` (`frontend/src/components/store/pdp/pdp-purchase-actions.tsx`).
  - Calls `handleAddToCart(redirectToCheckout)` -> `executeAddToCart`.

### B. PIM Architecture
- **Admin PIM Editor**: `frontend/src/components/dashboard/admin/pim-editor-modal.tsx`
  - Manages product master data, attributes, weights/sizes (`ProductWeightOption`), shapes, flavors, and pricing.
  - Connects to `/api/v1/admin/products` and `/api/v1/admin/products/:id/weights`.
- **Weight Matrix Utilities**: `frontend/src/lib/util/weight-matrix.ts`
  - Provides `parseAndNormalizeWeight`, `sortWeightOptions`, `getNextSuggestedWeight`, and `createDefaultWeightMatrix`.

### C. Product API Architecture
- **Catch-all API Route**: `frontend/src/app/api/v1/[...path]/route.ts`
  - Handles `/products`, `/products/:id`, `/store/products/:id`.
  - Queries `ProductRepository` and `ApiEngine.getProduct(...)`.
- **Database Repository**: `frontend/src/lib/repositories/product.repository.ts`
  - PostgreSQL queries on `product`, `product_variant`, `product_option`, `price` tables.

### D. Cart Architecture
- **Server Action**: `frontend/src/lib/actions/carts.ts`
  - In-process execution with `ApiEngine` and `CartRepository.saveCartItem`.
  - Sets cookies `_cth_cart_id`, `_medusa_cart_id` with 30-day maxAge and `path: "/"`.
- **Database Cart Repository**: `frontend/src/lib/repositories/cart.repository.ts`
  - Persists directly to PostgreSQL `cart` and `cart_line_item` tables.
- **Client State Synchronization**: `frontend/src/lib/cart/cart-event-bus.ts`
  - Dispatches `cartBus.emitCartUpdated(cart)` to keep header badge and drawer synchronized in real time.
- **Cart Drawer Modal**: `frontend/src/components/store/cart/cart-modal.tsx`
  - Rendered via React Portal at `z-[2000]`. Reads from `activeCart` and PostgreSQL `/api/v1/cart`.

### E. Current Storage Mechanisms
- **Session Identification Cookies**:
  - `_cth_cart_id`: Server cart UUID.
  - `_medusa_cart_id`: Medusa-compatible cart UUID.
  - `delivery_location`, `delivery_pincode`, `delivery_fee`, `delivery_eta`: Verified delivery cookies from resolver.
- **Client Fallback / Local Storage Audit**:
  - Must audit whether any `localStorage`, `sessionStorage`, or `IndexedDB` holds duplicate/hybrid cart item data.
  - Rule: Remove all hybrid cart item persistence. Preserve only legitimate session cookies.

---

## 3. Known Issues & Audit Targets
1. **Phantom "1 pc" Variant**: The product page displays `SELECT SIZE & WEIGHT *` with option `1 pc` for products (such as Butter Croissant or Chocolate Fudge Cupcake) that do NOT have a "1 piece" variation in CakeToHome business data.
2. **PIM / DB / API Mismatch**: Must determine whether "1 pc" comes from the database, PIM metadata, API mapping, frontend fallback logic, or quantity conversion.
3. **Cart Hybrid Storage**: Confirm and eliminate any secondary local storage holding cart line items or state.
4. **Delivery Data Truthfulness**: Ensure all delivery estimates, badges, and fees are 100% data-driven without static placeholders.

---

## 4. Suspected Origin of "1 pc"
- Suspect 1: `frontend/src/lib/data/catalog.ts` or `frontend/src/lib/repositories/product.repository.ts` synthesizes a synthetic variant when `variants` array is empty or has a unit like `"pc"` or `"piece"`.
- Suspect 2: `frontend/src/components/store/shop/product-detail-client.tsx` or `frontend/src/lib/util/weight-matrix.ts` creates a fallback weight option `"1 pc"` when `weight_prices` or `weightsList` is empty or formatted from a single unit.
- Suspect 3: The database `product` or `product_variant` record itself has `"1 pc"` seeded or stored in metadata.

---

## 5. Exact Next Step
Execute Section 4 and 5 of the audit:
Inspect the database tables (`product`, `product_variant`, `product_option`, `price`) for the affected products (`butter-croissant`, `chocolate-fudge-cupcake`), and trace the PIM definition and API response layers.
