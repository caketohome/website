# PHASE 6.1.3 — ARCHITECTURE & COMPONENT TOPOLOGY
## Clean Enterprise Boundary, Authoritative Verification & Asynchronous Event Processing
**Entity:** CakeToHome India Private Limited  
**CIN:** U15400KA2026PTC189211 | **GSTIN:** 29AABCC1234F1Z5  

---

### 1. High-Level Architecture Topology
The payment architecture strictly adheres to zero-trust client boundaries:

```
[ Customer Browser ]
       │ 1. Fill Checkout Form
       ▼
[ Next.js Storefront ] ──( POST /api/v1/payments/cashfree/order )──► [ Cashfree Service ]
       │                                                                  │
       │ 2. Return paymentSessionId                                       │ POST /pg/orders
       ▼                                                                  ▼
[ Cashfree Web SDK v3 ] ──( Official Checkout Modal / Redirect )──► [ Cashfree PG Cloud ]
       │                                                                  │
       │ 3. User Authorizes UPI/Card                                      │ 4. Webhook Notification
       ▼                                                                  ▼
[ Return /your-order ]                                             [ POST /api/v1/payments/cashfree/webhook ]
       │                                                                  │
       │ 5. GET /orders/{order_id}                                        │ HMAC-SHA256 Verification
       ▼                                                                  ▼
[ Independent Verification Engine ] ──────────────────────────────► [ Atomic DB Transaction ]
                                                                          ├─ Update Order Status
                                                                          ├─ Record Payment Tx
                                                                          ├─ Issue KOT Ticket
                                                                          ├─ Deduct Inventory
                                                                          ├─ Generate Tax Invoice
                                                                          └─ Post GL Journals
```

---

### 2. Client vs Server Boundary Segregation
- **Browser Client:** Only holds `orderId` and transient `paymentSessionId`. Has zero access to Cashfree App ID or Secret Key. Cannot mark orders as paid.
- **Next.js Server API:** Houses `CashfreePaymentService`, holds encrypted credentials, signs webhooks, and verifies payment statuses directly with Cashfree PG.
- **PostgreSQL Database:** Enforces ACID transactional integrity using `SELECT ... FOR UPDATE` row locks during payment confirmation.
