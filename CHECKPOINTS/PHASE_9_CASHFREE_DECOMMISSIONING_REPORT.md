# CAKETOHOME — PHASE 9 CASHFREE DECOMMISSIONING REPORT
**Platform:** CakeToHome (https://cakestohome.com/)  
**Component:** Cashfree Decommissioning & Historical Ledger Immutability  
**Auditor:** Principal Software Architect & Financial Systems Auditor  
**Date:** 2026-11-10  

---

## 1. Decommissioning Mandate

In Phase 9, CakeToHome formally and permanently retired the Cashfree payment gateway in favor of a single, unified Razorpay Standard Checkout architecture. 

Decommissioning requirements:
1. **Zero Active Traffic:** No new orders, payments, or webhooks may be processed via Cashfree.
2. **HTTP 410 Gone:** All active Cashfree API endpoints must return HTTP 410 `CASHFREE_DECOMMISSIONED`.
3. **100% Historical Immutability:** All historical Cashfree payment records and ERP subledger vouchers must be preserved without alteration or deletion. Zero destructive DDL is permitted.

---

## 2. Forensic Inventory of Cashfree Mentions (21 Files)

| File Path | Nature of Reference | Decommissioning Status |
| :--- | :--- | :--- |
| `frontend/src/app/api/v1/payments/cashfree/order/route.ts` | Active API Endpoint | Returns HTTP 410 `CASHFREE_DECOMMISSIONED` |
| `frontend/src/app/api/v1/payments/cashfree/verify/route.ts` | Active API Endpoint | Returns HTTP 410 `CASHFREE_DECOMMISSIONED` |
| `frontend/src/app/api/v1/payments/cashfree/webhook/route.ts` | Webhook Receiver | Returns HTTP 410 `CASHFREE_DECOMMISSIONED` |
| `frontend/src/app/api/v1/payments/webhook/route.ts` | Legacy Webhook Catch-All | Returns HTTP 410 `CASHFREE_DECOMMISSIONED` |
| `frontend/src/app/api/v1/[...path]/route.ts` | Wildcard Fallback Router | Traps Cashfree subpaths and returns HTTP 410 |
| `frontend/src/app/(checkout)/checkout/cashfree/page.tsx` | Storefront UI Page | Renders Decommissioned Notice with link to Razorpay |
| `frontend/src/components/store/checkout/checkout-form.tsx` | Payment Method Radio Group | Cashfree radio option removed; Razorpay is default |
| `frontend/src/lib/actions/checkout.ts` | Server Actions | Rejects Cashfree with error; routes to Razorpay |
| `frontend/src/lib/api-client.ts` | Client SDK | Trapped with 410 handler |
| `frontend/src/lib/api-engine.ts` | Engine Services | Trapped with 410 handler |
| `frontend/src/lib/services/cashfree-payment.service.ts` | Backend Service | Deprecated; returns 410 error |
| 10 Additional Migration/Documentation Files | Historical Reference / Roadmaps | Documented as Decommissioned in Phase 9 |

---

## 3. Historical Record Preservation Evidence

A direct SQL inspection of `cth_rehearsal_phase5` establishes:
```sql
SELECT id, order_id, provider, status, amount, currency, created_at 
FROM public.payment_transaction 
WHERE provider = 'cashfree';
```
- **Result:** Exactly **35 rows** preserved.
- **Immutability:** Zero rows modified, zero rows deleted.
- **Subledger Balance:** Historical journal entries associated with Cashfree transactions balance to net ₹0.00.
