# CAKETOHOME — PAYMENT STATE MACHINE
## Formal Transaction States, Invariants & Failure Defenses

### 1. State Transitions
```
[Initiated] ──> [Pending] ──> [Paid] ──> [Refunded]
                   |
                   └──> [Failed]
```

### 2. Safeguards
- **Amount Mismatch Defense (CF-11):** Webhook payment amount must match order `grand_total` within ₹0.05. Discrepancies mark event `amount_mismatch` without order confirmation.
- **Cancelled Order Defense (CF-12):** Webhooks for cancelled orders are flagged for refund and never confirmed.
