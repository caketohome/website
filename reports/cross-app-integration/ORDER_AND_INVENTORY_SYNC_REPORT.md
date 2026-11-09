# CAKETOHOME — ORDER & INVENTORY CROSS-APP SYNCHRONIZATION REPORT
**Project:** CakeToHome Unified Business Platform  
**Generated At:** 2026-11-06T00:25:16.162Z  

---

## 1. ORDER LIFECYCLE WALKTHROUGH
1. **Order Creation (`POST /api/v1/orders`):**
   - Created in status `pending`, payment status `pending`.
   - Appears immediately in Admin ERP Order Register and Branch Operations Queue.
2. **Payment Confirmation (`POST /api/v1/payments/cashfree/webhook`):**
   - Authenticates Cashfree HMAC-SHA256 signature.
   - Idempotently transitions order status to `confirmed` and payment status to `paid`.
   - Enqueues active KOT ticket in `public.kot_tickets` with sequenced `KOT-XXXXX` number.
   - Deducts stock from `public.branch_inventory` and logs audit line in `public.inventory_movement` (`direction='OUT'`, `movement_type='SALE'`).
   - Posts clearing voucher in accounting ledger (`Dr 1113 / Cr 2141`).
3. **Delivery Completion (`PATCH /api/v1/admin/orders/:id/status` -> `delivered`):**
   - Transitions order to `delivered` / `completed`.
   - Automatically allocates statutory CGST Rule 46 Tax Invoice (`CH/26-27/XXXXXX`).
   - Posts balanced Sales Revenue & GST Recognition Voucher (`Dr 2141 / Cr 4110 + Cr 2121 + Cr 2122`).
   - Updates Profit & Loss Statement and GST Invoice Register.
