# CakeToHome — Gate 4 (M4) Customer Profile, Strict Address Ownership & Order History Report

**Project:** CakeToHome — https://cakestohome.com/  
**Milestone:** M4 — Customer Profiles, Anti-IDOR Address Ownership & Relational Purchase History  
**Execution Date:** 2026-11-11  
**Architect & Lead Auditor:** Principal Software Architect, Application Security Engineer, Full-Stack Engineer, Database Architect  
**Status:** **SECURED, AUDITED & VERIFIED**

---

## 1. Executive Summary

Milestone M4 establishes rigorous security and customer data integrity standards:
1. **Strict Address Ownership (Anti-IDOR / Anti-BOLA):**
   - Implemented server-side ownership verification on all address mutations (`POST /api/customer/address`, `DELETE /api/customer/address`).
   - Hardened PostgreSQL persistence (`public.customer_address`) using conditional upserts (`ON CONFLICT ("id") DO UPDATE ... WHERE customer_address.customer_id = EXCLUDED.customer_id`) ensuring that cross-customer address overwrites are rejected at the database engine level.
2. **Relational Purchase History (`/account/orders`, `/api/customer/orders`):**
   - Refactored order history queries to join `public.order` and `public.order_item`, returning real items, pricing, GST tax breakdowns (`taxable_value`, `gst_rate_pct`, `tax_amount`), delivery time-slots, and payment statuses directly from PostgreSQL.
3. **Stock-Revalidated 1-Click Reorder Action (`/api/customer/orders/reorder`):**
   - Built a dedicated server-side reorder flow with strict anti-IDOR authentication.
   - For every historical item, verifies that the product is active in `public.product` and that accessory inventory is in stock at the fulfilling branch (`public.branch_inventory`).
   - Reconstructs a fresh customer cart and routes the customer seamlessly into checkout.

---

## 2. Security & Anti-IDOR Hardening

### 2.1 Database-Level Isolation (`public.customer_address`)
- Ensured relational columns in PostgreSQL `public.customer_address`: `id`, `customer_id`, `first_name`, `last_name`, `address_1`, `address_2`, `city`, `postal_code`, `phone`, `metadata`, `created_at`, `updated_at`.
- Configured PostgreSQL index on `customer_id`.
- Enforced strict owner matching during SQL upsert:
  ```sql
  INSERT INTO "customer_address" ("id", "customer_id", ...)
  VALUES ($1, $2, ...)
  ON CONFLICT ("id") DO UPDATE SET
    "address_1" = EXCLUDED.address_1,
    "updated_at" = NOW()
  WHERE customer_address.customer_id = EXCLUDED.customer_id;
  ```
  *Test Result:* Cross-customer update attempts affect **0 rows**, preventing hostile account takeovers.

### 2.2 Route-Level IDOR Validation (`frontend/src/app/api/customer/address/route.ts`)
- `POST`: If an existing address `id` is supplied in the request body, queries PostgreSQL to verify that the address belongs exclusively to the authenticated customer. Unmatched ownership triggers immediate **HTTP 403 Forbidden (`FORBIDDEN: Address ownership validation failed.`)**.
- `DELETE`: Verifies address ownership in PostgreSQL before execution. Unauthorized deletion returns **HTTP 403 Forbidden**.

### 2.3 Reorder Route Security (`frontend/src/app/api/customer/orders/reorder/route.ts`)
- Resolves verified customer credentials via cryptographically signed session tokens.
- Cross-references `order.customer_id`, `order.metadata->>'customer_uid'`, and normalized phone numbers.
- Unauthenticated requests return **HTTP 401 Unauthorized**. Unauthorized reorders of other customers' orders return **HTTP 403 Forbidden**.

---

## 3. Reorder Workflow & Stock Revalidation

```
[Customer clicks Reorder]
          │
          ▼
POST /api/customer/orders/reorder { order_id }
          │
          ├──> 1. Authenticate customer (anti-IDOR)
          ├──> 2. Fetch order items from public.order_item
          ├──> 3. Verify product active status in public.product
          ├──> 4. Verify branch stock in public.branch_inventory
          ├──> 5. Create fresh cart with current pricing
          └──> 6. Return cart_id & redirect to /cart
```

---

## 4. Verification Evidence

Direct automated tests (`scratch/test_m4_customer_and_orders.cjs`):
- **Test 1 (Customer & Address Seeding):** Successfully seeded Alice (A) and Bob (B) test accounts.
- **Test 2 (Database-Level Exploit Attempt):** Attempt to update Bob's address using Alice's ID affected **0 rows** (Blocked).
- **Test 3 (Unauthenticated Reorder Request):** Returned **HTTP 401 Unauthorized**.
- **Test 4 (Relational Order Data):** Order `ORD-999991` returned full item count, `grand_total: 706.82`, `tax_total`, and `paid` status.
- **Test 5 (Cleanup):** All test rows purged cleanly.
