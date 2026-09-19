# Checkpoint: Order Confirmation & Address Object React Child Fix

**Date:** 2026-09-19  
**Status:** Complete & Verified  

---

## 1. Problem Statement
When an order was confirmed and redirected to `/your-order?order_id=...`, React threw an unhandled runtime error:
```
Error: Objects are not valid as a React child (found: object with keys {city, email, line1, line2, phone, state, pincode, landmark, last_name, first_name}). If you meant to render a collection of children, use an array instead.
```

## 2. Root Cause Analysis
1. During checkout submission via `confirmCheckoutAction`, the address object with keys `{ first_name, last_name, phone, email, line1, line2, city, state, pincode, landmark, latitude, longitude }` was sent in the request body.
2. In `/api/v1/[...path]/route.ts` (inside `checkout/confirm`), `OrderService.createOrder` was called with `delivery_address: body.address` without string serialization or formatting.
3. In `OrderService.createOrder`, `delivery_address` directly stored this raw dictionary in `order.metadata.delivery_address`.
4. In `OrderRepository.mapRowToDomain`, `meta.delivery_address` was mapped to `customer.address` and `order.delivery_address` as-is.
5. In `src/app/(checkout)/your-order/page.tsx`, `{order.delivery_address}` was placed inside `<p>` tags as a direct JSX child:
   ```tsx
   <p className="font-medium text-pearl mt-0.5">{order.delivery_address}</p>
   ```
6. React's fiber reconciler (`throwOnInvalidObjectType`) crashed because a plain object was rendered directly as a React child.

## 3. Changes Made
1. **`frontend/src/app/(checkout)/your-order/page.tsx`**:
   - Safely formatted `order.delivery_address` in JSX. If it is a string, renders it directly; if it is an address object, joins `line1`, `line2`, `landmark`, `city`, `state`, and `pincode` into a comma-separated formatted address.
2. **`frontend/src/app/api/v1/[...path]/route.ts`**:
   - Formatted `body.address` into a clean address string before passing to `OrderService.createOrder`.
3. **`frontend/src/lib/services/order.service.ts`**:
   - Normalized `delivery_address` in `createOrder` to a formatted string if an object is passed, ensuring PostgreSQL metadata stores a valid string.
4. **`frontend/src/lib/repositories/order.repository.ts`**:
   - In `mapRowToDomain`, safely converted `meta.delivery_address` to a string if it was previously saved as an object, guaranteeing backward compatibility for historical orders.
5. **Dashboard Drawer Components**:
   - `admin/order-details-drawer.tsx`, `shop/order-details-drawer.tsx`, `shop/invoice-modal.tsx`, and `shop/branch-operations-manager.tsx` updated with safe string fallback guards for `delivery_address`.

## 4. Verification
- Navigated to `http://localhost:3000/your-order` via browser subagent. Confirmed page loads cleanly ("No Recent Order Found") without unhandled runtime errors.
- Navigated to `http://localhost:3000/checkout`, filled out Step 1 (Contact), Step 2 (Mode & Slots with location selection), and advanced to Step 3 (Review & Pay).
- Verified zero console errors and zero React child errors across all steps.
