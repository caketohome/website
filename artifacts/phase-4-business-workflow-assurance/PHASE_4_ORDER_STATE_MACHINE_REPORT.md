# CAKETOHOME — ORDER STATE MACHINE REPORT
## Formal State Transitions & Audit History

### 1. Permitted State Transitions
```
[ DRAFT ]
    │
    ▼
[ PENDING_PAYMENT ] ── (Payment Failed) ──► [ PAYMENT_FAILED ]
    │
    ▼ (Payment Captured)
[ CONFIRMED ]
    │
    ▼ (Kitchen Picked)
[ IN_PRODUCTION ]
    │
    ▼ (Baking Complete)
[ READY_FOR_PICKUP ]
    │
    ▼ (Rider Dispatched)
[ OUT_FOR_DELIVERY ]
    │
    ▼ (OTP Verified)
[ DELIVERED ] (Triggers Statutory CH Invoice Allocation)
```

### 2. State Invariants
- An order in `cancelled` state cannot be automatically reopened by a delayed payment webhook.
- An order in `delivered` state cannot be unilaterally refunded without a statutory return process.
- All state transitions record an immutable entry in `public.order_status_history`.
