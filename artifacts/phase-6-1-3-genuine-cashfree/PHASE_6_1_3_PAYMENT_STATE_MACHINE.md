# PHASE 6.1.3 — PAYMENT STATE MACHINE & INVARIANTS
## Mathematical State Transitions & Non-Reversible Invariants
**Entity:** CakeToHome India Private Limited  

---

### 1. Formal State Machine
```
[ DRAFT / CART ]
       │
       ▼
[ ORDER_CREATED (status: pending, payment: pending) ]
       │
       ▼
[ SESSION_INITIALIZED (payment_session_id generated) ]
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
[ PAYMENT_SUCCESS ]               [ PAYMENT_FAILED ]              [ PAYMENT_CANCELLED ]
       │                                 │                                 │
       ▼ (Gateway Verification)           ▼                                 ▼
[ ORDER_CONFIRMED & PAID ]         [ RETRY_ALLOWED ]                 [ ORDER_ABANDONED ]
       │
       ▼ (Fulfillment Dispatch)
[ IN_KITCHEN / PREPARATION ]
       │
       ▼
[ DISPATCHED / OUT_FOR_DELIVERY ]
       │
       ▼
[ DELIVERED ]
```

---

### 2. Core Invariants
- **I1:** An order cannot transition to `PAID` without cryptographic HMAC verification or direct Cashfree PG API verification.
- **I2:** KOT tickets, inventory stock deduction, and tax invoices are created only once per confirmed order.
- **I3:** Duplicate webhooks replay idempotently without double-fulfillment.
